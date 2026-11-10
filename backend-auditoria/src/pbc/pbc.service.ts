import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AccesoService } from '../auth/acceso.service';
import type { Contexto } from '../auth/decoradores';
import { BitacoraService } from '../bitacora/bitacora.service';
import { noEncontrado } from '../common/errores';
import { hoyEn } from '../common/utils/fechas';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { PbcRepository, SolicitudPbc } from '../datos/repositorios/pbc.repository';
import { UsuariosRepository } from '../datos/repositorios/usuarios.repository';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { ConsultarSolicitudesPbcDto, CrearSolicitudPbcDto, RevisarSolicitudPbcDto } from './pbc.dto';

/** Estados en los que el área auditada todavía debe responder. */
export const POR_RESPONDER = ['solicitada', 'reenviar'];

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

/** HU_05 · Solicitudes de información: el auditor pide, el auditado responde con un lote y el auditor revisa punto por punto. */
@Injectable()
export class PbcService {
  constructor(
    private readonly repo: PbcRepository,
    private readonly auditorias: AuditoriasRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly acceso: AccesoService,
    private readonly bitacora: BitacoraService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Días que faltan para la fecha límite, contados en la zona horaria de la unidad auditada. */
  private salida(s: SolicitudPbc, zona = 'America/Monterrey', ahora = new Date()) {
    const dias = s.fecha_limite ? diasEntre(hoyEn(zona, ahora), new Date(s.fecha_limite).toISOString().slice(0, 10)) : null;
    return {
      ...s, dias_restantes: dias, vencida: dias !== null && dias < 0 && POR_RESPONDER.includes(s.estado),
      cubiertos: s.puntos.filter((p) => p.estado === 'cubierto').length,
    };
  }

  /** Las que el usuario puede ver: las de sus auditorías visibles; el auditado, solo las que le tocan. */
  async listar(usuario: UsuarioSesion, f: ConsultarSolicitudesPbcDto = {}) {
    const visible = await this.acceso.filtro(usuario);
    const auditorias = new Map((await this.auditorias.listar()).filter(visible).map((a) => [a.id, a]));
    return (await this.repo.listar(f.auditoriaId))
      .filter((s) => auditorias.has(s.auditoria_id) && (!f.estado || s.estado === f.estado)
        && (usuario.rol !== 'auditado' || s.solicitado_a_id === usuario.id || s.solicitado_a_id === null))
      .map((s) => this.salida(s, auditorias.get(s.auditoria_id)?.zona_horaria));
  }

  async detalle(usuario: UsuarioSesion, id: number) {
    const s = (await this.listar(usuario)).find((x) => x.id === id);
    if (!s) throw noEncontrado('Solicitud de información');
    return s;
  }

  /** Auditados que participan en la auditoría: son a quienes se les puede pedir información. */
  async auditadosDe(auditoriaId: number) {
    const ids: number[] = [];
    for (const u of (await this.usuarios.listarActivos()).filter((x) => x.rol === 'auditado')) {
      if ((await this.auditorias.auditoriasDeParticipante(u.id)).includes(auditoriaId)) ids.push(u.id);
    }
    return ids;
  }

  async responsables(usuario: UsuarioSesion, auditoriaId: number) {
    await this.acceso.auditoriaVisible(usuario, auditoriaId);
    const ids = new Set(await this.auditadosDe(auditoriaId));
    return (await this.usuarios.listarActivos()).filter((u) => ids.has(u.id)).map((u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, unidad: u.unidad }));
  }

  async crear(ctx: Contexto, dto: CrearSolicitudPbcDto) {
    const auditoria = await this.acceso.auditoriaAbierta(ctx.usuario, dto.auditoriaId);
    const p = await this.auditorias.procedimiento(dto.procedimientoId);
    if (!p || p.auditoria_id !== auditoria.id) throw new BadRequestException('El procedimiento no pertenece a la auditoría.');
    if (!(await this.auditadosDe(auditoria.id)).includes(dto.solicitadoAId)) {
      throw new BadRequestException('El responsable debe ser un usuario auditado que participe en la auditoría.');
    }
    if (dto.fechaLimite < hoyEn(auditoria.zona_horaria)) throw new BadRequestException('La fecha límite no puede ser anterior a hoy.');
    const id = await this.repo.crear({
      procedimientoId: p.id, solicitadoPorId: ctx.usuario.id, solicitadoAId: dto.solicitadoAId, asunto: dto.asunto.trim(),
      fechaLimite: new Date(`${dto.fechaLimite}T00:00:00.000Z`),
      puntos: dto.puntos.map((x) => ({ descripcion: x.descripcion.trim(), obligatorio: x.obligatorio ?? true })),
    });
    const s = (await this.repo.buscar(id))!;
    await this.bitacora.registrarOperacion(ctx, { entidad: 'solicitudes_pbc', entidadId: id, folio: s.tracking_id, accion: 'CREAR', nuevo: {
      auditoria: auditoria.tracking_id, procedimiento: p.tracking_id, responsable: s.solicitado_a, fecha_limite: dto.fechaLimite, puntos: s.puntos.length,
    } });
    await this.notificaciones.avisar([dto.solicitadoAId], {
      tipo: 'solicitud_pbc', auditoriaId: auditoria.id,
      mensaje: `${s.tracking_id} · ${auditoria.tracking_id}: ${ctx.usuario.nombre} pide ${s.puntos.length} documento${s.puntos.length === 1 ? '' : 's'} sobre "${s.asunto}" antes del ${dto.fechaLimite}.`,
    });
    return this.salida(s, auditoria.zona_horaria);
  }

  /**
   * Versión de la primera entrega (botón "Pedir información" por procedimiento): sin puntos ni fecha límite.
   * Si ya hay una abierta para ese procedimiento, regresa esa.
   */
  async crearSimple(ctx: Contexto, auditoriaId: number, procedimientoId: number) {
    const auditoria = await this.acceso.auditoriaAbierta(ctx.usuario, auditoriaId);
    const p = await this.auditorias.procedimiento(procedimientoId);
    if (!p || p.auditoria_id !== auditoriaId) throw new BadRequestException('El procedimiento no pertenece a la auditoría.');
    const existente = (await this.repo.listar(auditoriaId)).find((s) => s.procedimiento_id === procedimientoId && POR_RESPONDER.includes(s.estado));
    if (existente) return this.salida(existente, auditoria.zona_horaria);
    const id = await this.repo.crear({ procedimientoId, solicitadoPorId: ctx.usuario.id, solicitadoAId: null, asunto: `Información del procedimiento ${p.tracking_id}`, fechaLimite: null, puntos: [] });
    const s = (await this.repo.buscar(id))!;
    await this.bitacora.registrarOperacion(ctx, { entidad: 'solicitudes_pbc', entidadId: id, folio: s.tracking_id, accion: 'CREAR', nuevo: { procedimiento: p.tracking_id } });
    await this.notificaciones.avisar(await this.auditadosDe(auditoriaId), {
      tipo: 'solicitud_pbc', auditoriaId,
      mensaje: `${s.tracking_id} · ${auditoria.tracking_id}: ${ctx.usuario.nombre} pide información del procedimiento ${p.tracking_id} (${p.control}).`,
    });
    return this.salida(s, auditoria.zona_horaria);
  }

  /** El área auditada respondió con un lote: la solicitud pasa a "enviada" y se avisa a quien la pidió. */
  async marcarEnviada(ctx: Contexto, solicitudId: number, lote: string) {
    const s = await this.repo.buscar(solicitudId);
    if (!s) return;
    await this.repo.actualizar(solicitudId, { estado: 'enviada', enviado: new Date() });
    await this.bitacora.registrarOperacion(ctx, { entidad: 'solicitudes_pbc', entidadId: s.id, folio: s.tracking_id, accion: 'ACTUALIZAR', anterior: { estado: s.estado }, nuevo: { estado: 'enviada', lote } });
    await this.notificaciones.avisar([s.solicitado_por_id], {
      tipo: 'solicitud_pbc_respondida', auditoriaId: s.auditoria_id,
      mensaje: `${s.tracking_id}: ${ctx.usuario.nombre} respondió con el lote ${lote}. Revisa qué puntos quedaron cubiertos.`,
    });
  }

  /** El auditor marca cada punto y acepta la respuesta o pide que se corrija. */
  async revisar(ctx: Contexto, id: number, dto: RevisarSolicitudPbcDto) {
    const s = await this.detalle(ctx.usuario, id);
    if (s.estado !== 'enviada') throw new ConflictException(`La solicitud está en "${s.estado}"; solo se revisa cuando el área ya envió su respuesta.`);
    const comentario = dto.comentario?.trim() || null;
    if (dto.decision === 'reenviar' && !comentario) throw new BadRequestException('Explica qué falta para que el área pueda corregir.');
    const ajenos = (dto.puntos ?? []).filter((x) => !s.puntos.some((p) => p.id === x.id));
    if (ajenos.length) throw new BadRequestException('Algún punto no pertenece a esta solicitud.');
    await this.repo.marcarPuntos(id, dto.puntos ?? []);
    const estado = dto.decision === 'completa' ? 'completa' : 'reenviar';
    await this.repo.actualizar(id, { estado, comentario_revision: comentario, cerrado: estado === 'completa' ? new Date() : null });
    await this.bitacora.registrarOperacion(ctx, { entidad: 'solicitudes_pbc', entidadId: id, folio: s.tracking_id, accion: estado === 'completa' ? 'APROBAR' : 'RECHAZAR',
      anterior: { estado: s.estado }, nuevo: { estado, comentario, cubiertos: (dto.puntos ?? []).filter((x) => x.estado === 'cubierto').length } });
    await this.notificaciones.avisar([s.solicitado_a_id], {
      tipo: estado === 'completa' ? 'solicitud_pbc_completa' : 'solicitud_pbc_reenviar', auditoriaId: s.auditoria_id,
      mensaje: estado === 'completa'
        ? `${s.tracking_id}: ${ctx.usuario.nombre} aceptó tu respuesta. La solicitud quedó completa.`
        : `${s.tracking_id}: ${ctx.usuario.nombre} pide corregir tu respuesta. "${comentario}"`,
    });
    return this.detalle(ctx.usuario, id);
  }
}
