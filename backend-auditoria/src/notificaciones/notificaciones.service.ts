import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { usaSql } from '../datos/datos.module';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { NotificacionesRepository, NuevaNotificacion } from '../datos/repositorios/notificaciones.repository';
import { PlanesRepository } from '../datos/repositorios/planes.repository';
import { PbcRepository } from '../datos/repositorios/pbc.repository';
import { hoyEn } from '../common/utils/fechas';
import { UsuariosRepository } from '../datos/repositorios/usuarios.repository';
import type { PlanVista, UsuarioSesion } from '../datos/repositorios/vistas';
import { semaforo } from '../planes/semaforo';

/** Planes que todavía dependen del responsable; los que están en revisión o cerrados ya no reciben avisos. */
const ACTIVOS = ['abierto', 'en_progreso', 'rechazado'];
const LIMITE_BANDEJA = 40;

/** HU_12 · 15, 5 y 1 día antes del vencimiento; vencido sin solventar, escalamiento. */
export function avisoDeVencimiento(diasRestantes: number): string | null {
  if (diasRestantes < 0) return 'escalamiento';
  if (diasRestantes <= 1) return 'vencimiento_1';
  if (diasRestantes <= 5) return 'vencimiento_5';
  if (diasRestantes <= 15) return 'vencimiento_15';
  return null;
}

const dias = (n: number) => `${n} día${n === 1 ? '' : 's'}`;

@Injectable()
export class NotificacionesService {
  private readonly log = new Logger(NotificacionesService.name);

  constructor(
    private readonly repo: NotificacionesRepository,
    private readonly planes: PlanesRepository,
    private readonly auditorias: AuditoriasRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly pbc: PbcRepository,
  ) {}

  async bandeja(usuario: UsuarioSesion, soloNoLeidas = false) {
    const [items, noLeidas] = await Promise.all([this.repo.listar(usuario.id, LIMITE_BANDEJA), this.repo.noLeidas(usuario.id)]);
    return { noLeidas, items: soloNoLeidas ? items.filter((n) => !n.leida) : items };
  }

  async marcarLeida(usuario: UsuarioSesion, id: number) {
    if (!(await this.repo.marcarLeida(id, usuario.id))) throw new NotFoundException('Notificación no encontrada.');
    return { noLeidas: await this.repo.noLeidas(usuario.id) };
  }

  async marcarTodas(usuario: UsuarioSesion) {
    await this.repo.marcarTodas(usuario.id);
    return { noLeidas: 0 };
  }

  /** Un aviso nunca debe tumbar la operación que lo dispara: si falla, sólo queda en el log. */
  async avisar(usuarioIds: (number | null | undefined)[], datos: Omit<NuevaNotificacion, 'usuarioId'>) {
    for (const usuarioId of new Set(usuarioIds.filter((id): id is number => !!id))) {
      try { await this.repo.crear({ ...datos, usuarioId }); }
      catch (e) { this.log.warn(`No se pudo notificar a ${usuarioId} (${datos.tipo}): ${(e as Error).message}`); }
    }
  }

  /** Responsable del escalamiento: el líder de la auditoría y los gerentes de la misma dirección. */
  private async escalarA(plan: PlanVista, activos: UsuarioSesion[]) {
    const auditoria = await this.auditorias.buscar(plan.auditoria_id);
    const gerentes = activos.filter((u) => u.rol === 'gerente' && u.direccion === plan.direccion).map((u) => u.id);
    return [auditoria?.lider_id, ...gerentes];
  }

  /**
   * Corre una vez al día (Vercel Cron). Cada aviso se manda una sola vez por plan y tipo, así que
   * volver a correrla el mismo día no duplica nada.
   */
  async revisarVencimientos(ahora: Date = new Date()) {
    const activos = await this.usuarios.listarActivos();
    const enviadas: { plan: string; tipo: string; usuarios: number }[] = [];
    const planes = (await this.planes.listar()).filter((p) => ACTIVOS.includes(p.estado) && p.avance_pct < 100);
    for (const p of planes) {
      const { diasRestantes } = semaforo(p, ahora);
      const tipo = avisoDeVencimiento(diasRestantes);
      if (!tipo) continue;
      const destinatarios = tipo === 'escalamiento' ? await this.escalarA(p, activos) : [p.responsable_id];
      const pendientes: number[] = [];
      for (const id of new Set(destinatarios.filter((x): x is number => !!x))) {
        if (!(await this.repo.yaEnviada(id, p.id, tipo))) pendientes.push(id);
      }
      if (!pendientes.length) continue;
      const mensaje = tipo === 'escalamiento'
        ? `${p.tracking_id} venció hace ${dias(-diasRestantes)} con ${p.avance_pct}% de avance. Responsable: ${p.responsable}.`
        : `${p.tracking_id} vence ${diasRestantes === 0 ? 'hoy' : `en ${dias(diasRestantes)}`} y lleva ${p.avance_pct}% de avance: ${p.descripcion}`;
      await this.avisar(pendientes, { tipo, mensaje, planId: p.id, auditoriaId: p.auditoria_id });
      enviadas.push({ plan: p.tracking_id, tipo, usuarios: pendientes.length });
    }
    enviadas.push(...await this.revisarSolicitudesPbc(ahora));
    return { revisados: planes.length, enviadas };
  }

  /** HU_05 · Misma regla para las solicitudes de información que siguen sin respuesta. */
  private async revisarSolicitudesPbc(ahora: Date) {
    const enviadas: { plan: string; tipo: string; usuarios: number }[] = [];
    const auditorias = new Map((await this.auditorias.listar()).map((a) => [a.id, a]));
    for (const s of (await this.pbc.listar()).filter((x) => ['solicitada', 'reenviar'].includes(x.estado) && x.fecha_limite)) {
      const auditoria = auditorias.get(s.auditoria_id);
      const hoy = hoyEn(auditoria?.zona_horaria ?? 'America/Monterrey', ahora);
      const dias = Math.round((Date.parse(new Date(s.fecha_limite!).toISOString().slice(0, 10)) - Date.parse(hoy)) / 86_400_000);
      const aviso = avisoDeVencimiento(dias);
      if (!aviso) continue;
      const tipo = aviso === 'escalamiento' ? 'pbc_vencida' : `pbc_${aviso}`;
      const destinatarios = aviso === 'escalamiento' ? [s.solicitado_por_id, auditoria?.lider_id] : [s.solicitado_a_id];
      const pendientes: number[] = [];
      for (const id of new Set(destinatarios.filter((x): x is number => !!x))) {
        if (!(await this.repo.yaEnviadaConFolio(id, tipo, s.tracking_id))) pendientes.push(id);
      }
      if (!pendientes.length) continue;
      const mensaje = aviso === 'escalamiento'
        ? `${s.tracking_id}: ${s.solicitado_a ?? 'El área auditada'} no ha respondido "${s.asunto ?? s.procedimiento}" y venció hace ${dias === -1 ? '1 día' : `${-dias} días`}.`
        : `${s.tracking_id}: tienes ${dias === 0 ? 'hasta hoy' : dias === 1 ? '1 día' : `${dias} días`} para responder "${s.asunto ?? s.procedimiento}".`;
      await this.avisar(pendientes, { tipo, mensaje, auditoriaId: s.auditoria_id });
      enviadas.push({ plan: s.tracking_id, tipo, usuarios: pendientes.length });
    }
    return enviadas;
  }

  /**
   * Demo y pruebas: llena la bandeja del usuario con un aviso de cada tipo, usando folios reales.
   * Con `retrasoSegundos` los avisos llegan después, para ver cómo aparecen mientras la app está abierta.
   */
  async simular(usuario: UsuarioSesion, retrasoSegundos = 0) {
    if (usaSql && process.env.PERMITIR_SIMULACION !== '1') throw new ConflictException('La simulación de notificaciones está desactivada en este entorno.');
    const [plan] = await this.planes.listar();
    const auditoria = plan ? await this.auditorias.buscar(plan.auditoria_id) : (await this.auditorias.listar())[0];
    const rp = plan?.tracking_id ?? 'RP-000001';
    const aud = auditoria?.tracking_id ?? 'AUD-000001';
    const base = { planId: plan?.id ?? null, auditoriaId: auditoria?.id ?? null };
    const avisos: Omit<NuevaNotificacion, 'usuarioId'>[] = [
      { ...base, tipo: 'PLAN_ASIGNADO', mensaje: `Se te ha asignado el plan ${rp}: ${plan?.descripcion ?? 'Plan de remediación'}` },
      { ...base, tipo: 'solicitud_pbc', mensaje: `${aud}: el equipo de auditoría pide información del procedimiento AP-000004.` },
      { ...base, tipo: 'lote_recibido', mensaje: `${aud}: E. Ramos envió 3 documentos en respuesta a una solicitud.`, planId: null },
      { ...base, tipo: 'analisis_listo', mensaje: `${aud}: la IA terminó de revisar 3 documentos y encontró 2 evidencias faltantes.`, planId: null },
      { ...base, tipo: 'vencimiento_5', mensaje: `${rp} vence en 5 días y lleva 60% de avance.` },
      { ...base, tipo: 'escalamiento', mensaje: `${rp} venció hace 2 días con 30% de avance. Responsable: E. Ramos.` },
      { ...base, tipo: 'plan_rechazado', mensaje: `${rp}: Revisor de Control Interno rechazó el plan. "Falta la evidencia del cierre de la partida."` },
    ];
    const enviar = async () => {
      for (const a of avisos) await this.avisar([usuario.id], a);
    };
    if (retrasoSegundos > 0) {
      const tarea = new Promise<void>((r) => setTimeout(r, retrasoSegundos * 1000)).then(enviar);
      try { waitUntil(tarea); } catch { /* Fuera de Vercel basta con la promesa. */ }
      return { programadas: avisos.length, enSegundos: retrasoSegundos };
    }
    await enviar();
    return { programadas: avisos.length, enSegundos: 0 };
  }
}
