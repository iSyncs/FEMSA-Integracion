import { ConflictException, Injectable } from '@nestjs/common';
import { BaseDeDatosMemoria } from './base-de-datos-memoria';
import { UsuariosRepository, CatalogosRepository } from '../repositorios/usuarios.repository';
import { AuditoriasRepository, NuevaAuditoria } from '../repositorios/auditorias.repository';
import { HallazgosRepository, NuevoHallazgo } from '../repositorios/hallazgos.repository';
import { PlanesRepository } from '../repositorios/planes.repository';
import { CierreRepository } from '../repositorios/cierre.repository';
import type {
  Aprobacion, Auditoria, Avance, Cierre, EstadoAuditoria, EstadoProcedimiento, EvaluacionProcedimiento, Hallazgo, NivelAprobacion, Plan,
} from '../modelos';
import type { Contexto } from '../../auth/decoradores';
import type {
  AprobacionVista, AuditoriaVista, EvidenciaVista, HallazgoVista, PlanVista, ProcedimientoVista,
  UsuarioSesion,
} from '../repositorios/vistas';

const copia = <T>(x: T): T => structuredClone(x);
const abierto = (h: Hallazgo) => h.estado !== 'solventado' && h.estado !== 'rechazado';

@Injectable()
export class UsuariosMemoriaRepository extends UsuariosRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  private vista(id: number): UsuarioSesion | null {
    const u = this.db.usuarios.find((x) => x.id === id && x.activo);
    if (!u) return null;
    const rol = this.db.roles.find((r) => r.id === u.rol_id)!;
    const unidad = this.db.unidades.find((x) => x.id === u.unidad_negocio_id);
    return {
      id: u.id, nombre: u.nombre, correo: u.correo, direccion: u.direccion, unidad_negocio_id: u.unidad_negocio_id,
      zona_horaria: u.zona_horaria, rol: rol.clave, rol_nombre: rol.nombre, unidad: unidad?.unidad ?? null,
    };
  }

  async listarActivos() {
    return this.db.usuarios.filter((u) => u.activo)
      .sort((a, b) => a.rol_id - b.rol_id || a.nombre.localeCompare(b.nombre))
      .map((u) => this.vista(u.id)!);
  }

  async buscarActivo(id: number) {
    return this.vista(id);
  }

  async credencial(correo: string) {
    const u = this.db.usuarios.find((x) => x.activo && x.correo.toLowerCase() === correo.trim().toLowerCase());
    return u ? { id: u.id, contrasena_hash: u.contrasena_hash } : null;
  }
}

@Injectable()
export class CatalogosMemoriaRepository extends CatalogosRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  async unidades() {
    return copia(this.db.unidades).sort((a, b) => a.direccion.localeCompare(b.direccion) || a.unidad.localeCompare(b.unidad));
  }

  async unidad(id: number) {
    return copia(this.db.unidades.find((u) => u.id === id) ?? null);
  }

  async controles() {
    return this.db.controles.map((c) => {
      const r = this.db.riesgos.find((x) => x.id === c.riesgo_id)!;
      return { ...copia(c), riesgo_folio: r.tracking_id, riesgo: r.nombre };
    });
  }

  async riesgos() {
    return copia(this.db.riesgos);
  }
}

@Injectable()
export class AuditoriasMemoriaRepository extends AuditoriasRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  private vista(a: Auditoria): AuditoriaVista {
    const un = this.db.unidades.find((u) => u.id === a.unidad_negocio_id)!;
    const procs = this.db.procedimientos.filter((p) => p.auditoria_id === a.id);
    const hs = this.db.hallazgos.filter((h) => h.auditoria_id === a.id && abierto(h));
    return {
      ...copia(a), unidad: un.unidad, direccion: un.direccion, pais: un.pais, zona_horaria: un.zona_horaria,
      lider: this.db.usuarios.find((u) => u.id === a.lider_id)?.nombre ?? '',
      procedimientos: procs.length, supervisados: procs.filter((p) => p.estado === 'supervisado').length,
      hallazgos_abiertos: hs.length, hallazgos_criticos: hs.filter((h) => h.severidad === 'Crítica').length,
    };
  }

  async listar() {
    const prioridad = { Alta: 0, Media: 1, Baja: 2 };
    return this.db.auditorias.map((a) => this.vista(a)).sort((x, y) =>
      Number(x.estado === 'cerrada') - Number(y.estado === 'cerrada')
      || prioridad[x.prioridad] - prioridad[y.prioridad]
      || (x.fecha_fin?.getTime() ?? 0) - (y.fecha_fin?.getTime() ?? 0));
  }

  async buscar(id: number) {
    const a = this.db.auditorias.find((x) => x.id === id);
    return a ? this.vista(a) : null;
  }

  async crear(datos: NuevaAuditoria) {
    const a: Auditoria = {
      ...datos, id: this.db.siguienteId('auditorias'), tracking_id: this.db.siguienteFolio('aud'), estado: 'pendiente', creado_en: new Date(),
    };
    this.db.auditorias.push(a);
    return copia(a);
  }

  async cambiarEstado(id: number, estado: EstadoAuditoria) {
    const a = this.db.auditorias.find((x) => x.id === id);
    if (a) a.estado = estado;
  }

  async auditoriasDeParticipante(usuarioId: number) {
    return this.db.participantes.filter((p) => p.usuario_id === usuarioId).map((p) => p.auditoria_id);
  }

  async procedimientos(auditoriaId: number): Promise<ProcedimientoVista[]> {
    return this.db.procedimientos.filter((p) => p.auditoria_id === auditoriaId).map((p) => {
      const c = this.db.controles.find((x) => x.id === p.control_id)!;
      const r = this.db.riesgos.find((x) => x.id === c.riesgo_id)!;
      return {
        ...copia(p), control_folio: c.tracking_id, control: c.nombre, riesgo_folio: r.tracking_id, riesgo: r.nombre,
        auditor: this.db.usuarios.find((u) => u.id === p.auditor_id)?.nombre ?? null,
      };
    });
  }

  async procedimiento(id: number): Promise<ProcedimientoVista | null> {
    const p = this.db.procedimientos.find((x) => x.id === id);
    if (!p) return null;
    return (await this.procedimientos(p.auditoria_id)).find((x) => x.id === id) ?? null;
  }

  async evaluarProcedimiento(id: number, evaluacion: EvaluacionProcedimiento, ctx: Contexto) {
    const p = this.db.procedimientos.find((x) => x.id === id)!;
    Object.assign(p, evaluacion, { estado: 'evaluado' as const, fecha_evaluacion: new Date() });
    this.db.bitacora.push({
      id: this.db.siguienteId('bitacora'), entidad: 'procedimientos_auditoria', entidad_id: p.id,
      folio: p.tracking_id, accion: 'EVALUAR', usuario_id: ctx.usuario.id,
      detalle: JSON.stringify({
        diseno: p.calif_diseno, efectividad: p.calif_efectividad,
        vulnerabilidad_historica: p.vulnerabilidad, estado: p.estado, avance: 70,
      }),
      ip: ctx.ip, zona_horaria: ctx.zonaHoraria, fecha: new Date(),
    });
    return copia(p);
  }

  async procedimientosPorEstado(auditoriaIds: number[]) {
    const ids = new Set(auditoriaIds);
    const conteo: Record<EstadoProcedimiento, number> = { abierto: 0, evaluado: 0, revisado: 0, supervisado: 0, rechazado: 0 };
    for (const p of this.db.procedimientos) if (ids.has(p.auditoria_id)) conteo[p.estado]++;
    return conteo;
  }

  async evidencias(auditoriaId: number): Promise<EvidenciaVista[]> {
    const procs = new Set(this.db.procedimientos.filter((p) => p.auditoria_id === auditoriaId).map((p) => p.id));
    const hs = new Set(this.db.hallazgos.filter((h) => h.auditoria_id === auditoriaId).map((h) => h.id));
    const directas = this.db.evidencias.filter((e) => !e.eliminado && ((e.procedimiento_id && procs.has(e.procedimiento_id)) || (e.hallazgo_id && hs.has(e.hallazgo_id))));
    const ids = new Set(directas.map((e) => e.id));
    const hijas = this.db.evidencias.filter((e) => !e.eliminado && e.evidencia_padre_id && ids.has(e.evidencia_padre_id));
    return [...directas, ...hijas]
      .sort((a, b) => a.tracking_id.localeCompare(b.tracking_id))
      .map((e) => ({ ...copia(e), cargado_por: this.db.usuarios.find((u) => u.id === e.cargado_por_id)?.nombre ?? '' }));
  }
}

@Injectable()
export class HallazgosMemoriaRepository extends HallazgosRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  private vista(h: Hallazgo): HallazgoVista {
    const a = this.db.auditorias.find((x) => x.id === h.auditoria_id)!;
    const un = this.db.unidades.find((u) => u.id === a.unidad_negocio_id)!;
    return {
      ...copia(h), auditoria_folio: a.tracking_id, auditoria: a.nombre, unidad: un.unidad, area: un.area,
      unidad_negocio_id: un.id, direccion: un.direccion,
      responsable: this.db.usuarios.find((u) => u.id === h.responsable_id)?.nombre ?? null,
      planes: this.db.planes.filter((p) => p.hallazgo_id === h.id).length,
      origen_ia: this.db.bitacora.some((b) => b.entidad === 'sugerencias_ia' && b.accion === 'ACTUALIZAR' && (b.detalle ?? '').includes(h.tracking_id)),
    };
  }

  async listar() {
    const orden = { 'Crítica': 0, Alta: 1, Moderada: 2, Baja: 3 };
    return this.db.hallazgos.map((h) => this.vista(h)).sort((x, y) =>
      orden[x.severidad] - orden[y.severidad] || y.fecha_identificacion.getTime() - x.fecha_identificacion.getTime());
  }

  async porAuditoria(auditoriaId: number) {
    return this.db.hallazgos.filter((h) => h.auditoria_id === auditoriaId).map((h) => this.vista(h));
  }

  async crear(datos: NuevoHallazgo) {
    if (this.db.auditorias.find((a) => a.id === datos.auditoria_id)?.estado === 'cerrada') {
      throw new ConflictException('Expediente cerrado: el hallazgo es de solo lectura.');
    }
    const h: Hallazgo = {
      ...datos, id: this.db.siguienteId('hallazgos'), tracking_id: this.db.siguienteFolio('fnd'), estado: 'abierto',
      riesgo_residual: null, responsable_id: null, fecha_identificacion: new Date(new Date().toISOString().slice(0, 19) + 'Z'),
    };
    this.db.hallazgos.push(h);
    return copia(h);
  }

  async cambiarEstado(id: number, estado: Hallazgo['estado']) {
    const h = this.db.hallazgos.find((x) => x.id === id);
    if (h) h.estado = estado;
  }

  async procedimientoPerteneceA(procedimientoId: number, auditoriaId: number) {
    return this.db.procedimientos.some((p) => p.id === procedimientoId && p.auditoria_id === auditoriaId);
  }

  async marcarProcedimientoConHallazgo(procedimientoId: number) {
    const p = this.db.procedimientos.find((x) => x.id === procedimientoId);
    if (p) p.aplica_hallazgo = true;
  }
}

@Injectable()
export class PlanesMemoriaRepository extends PlanesRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  private vista(p: Plan): PlanVista {
    const h = this.db.hallazgos.find((x) => x.id === p.hallazgo_id)!;
    const a = this.db.auditorias.find((x) => x.id === h.auditoria_id)!;
    const un = this.db.unidades.find((u) => u.id === a.unidad_negocio_id)!;
    return {
      ...copia(p), responsable: this.db.usuarios.find((u) => u.id === p.responsable_id)?.nombre ?? '',
      hallazgo_folio: h.tracking_id, hallazgo: h.titulo, severidad: h.severidad, auditoria_id: a.id,
      auditoria_folio: a.tracking_id, auditoria: a.nombre, unidad: un.unidad, zona_horaria: un.zona_horaria,
      unidad_negocio_id: un.id, direccion: un.direccion,
    };
  }

  async listar() {
    return this.db.planes.map((p) => this.vista(p)).sort((x, y) => x.fecha_compromiso.getTime() - y.fecha_compromiso.getTime());
  }

  async buscar(id: number) {
    const p = this.db.planes.find((x) => x.id === id);
    return p ? this.vista(p) : null;
  }

  /*
   * HU_09: 
   * La asignación genera inmediatamente una notificación para el responsable.
   */
  async crear(datos: Omit<Plan, 'id' | 'tracking_id'>) {
    const plan: Plan = {
      ...datos,
      id: this.db.siguienteId('planes'),
      tracking_id: this.db.siguienteFolio('rp'),
    };
  
    this.db.planes.push(plan);
  
    this.db.notificaciones.push({
      id: this.db.siguienteId('notificaciones'),
      usuario_id: plan.responsable_id,
      plan_id: plan.id,
      auditoria_id: null,
      tipo: 'PLAN_ASIGNADO',
      mensaje: `Se te ha asignado el plan ${plan.tracking_id}: ${plan.descripcion}`,
      canal: 'plataforma',
      fecha_programada: null,
      fecha_envio: new Date(),
      leida: false,
    });
  
    return copia(plan);
  }

  async actualizar(id: number, cambios: Partial<Pick<Plan, 'estado' | 'avance_pct' | 'fecha_conclusion'>>) {
    const p = this.db.planes.find((x) => x.id === id);
    if (p) Object.assign(p, cambios);
  }

  async registrarAvance(avance: Omit<Avance, 'id' | 'fecha'>) {
    const a: Avance = { ...avance, id: this.db.siguienteId('avances'), fecha: new Date() };
    this.db.avances.push(a);
    return copia(a);
  }

  async avances(planId: number) {
    return this.db.avances.filter((a) => a.plan_id === planId)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .map((a) => ({ ...copia(a), usuario: this.db.usuarios.find((u) => u.id === a.actualizado_por_id)?.nombre ?? '' }));
  }

  async validar(id: number, estadoEsperado: Plan['estado'], decision: 'aprobado' | 'rechazado', comentario: string | null, usuario: UsuarioSesion, zonaHoraria: string, ip: string | null) {
    // Operación sin awaits: en el adaptador en memoria, el cambio, historial y solventación son indivisibles.
    const p = this.db.planes.find((x) => x.id === id);
    if (!p || p.estado !== estadoEsperado) throw new ConflictException('El plan cambió de estado o ya fue validado; consulta su estado actual.');
    const fecha = new Date();
    const etapa = estadoEsperado === 'revision_grc' ? 'grc' : 'jefatura';
    p.estado = decision === 'rechazado' ? 'en_progreso' : etapa === 'grc' ? 'revision_jefe' : 'cerrado';
    if (p.estado === 'cerrado') p.fecha_conclusion = fecha;
    if (decision === 'rechazado') p.fecha_conclusion = null;
    const hallazgo = this.db.hallazgos.find((h) => h.id === p.hallazgo_id);
    if (decision === 'aprobado' && p.estado === 'cerrado' && hallazgo) {
      const planes = this.db.planes.filter((x) => x.hallazgo_id === hallazgo.id);
      if (planes.length > 0 && planes.every((x) => x.estado === 'cerrado')) hallazgo.estado = 'solventado';
    }
    this.db.avances.push({
      id: this.db.siguienteId('avances'), plan_id: p.id, avance_pct: p.avance_pct,
      comentario: comentario ?? `Validación ${etapa}: aprobado.`, evidencia_id: null,
      actualizado_por_id: usuario.id, fecha, zona_horaria: zonaHoraria,
    });
    this.db.bitacora.push({
      id: this.db.siguienteId('bitacora'), entidad: 'planes', entidad_id: p.id, folio: p.tracking_id,
      accion: 'VALIDACION', usuario_id: usuario.id,
      detalle: JSON.stringify({ etapa, decision, comentario, estado_resultante: p.estado }), ip,
      zona_horaria: zonaHoraria, fecha,
    });
  }

  async hallazgosSinPlan(auditoriaId: number) {
    return this.db.hallazgos
      .filter((h) => h.auditoria_id === auditoriaId && !this.db.planes.some((p) => p.hallazgo_id === h.id))
      .map((h) => ({ id: h.id, tracking_id: h.tracking_id, titulo: h.titulo }));
  }
}

@Injectable()
export class CierreMemoriaRepository extends CierreRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  async aprobaciones(auditoriaId: number): Promise<AprobacionVista[]> {
    return this.db.aprobaciones.filter((a) => a.auditoria_id === auditoriaId)
      .sort((a, b) => a.secuencia - b.secuencia)
      .map((a) => ({ ...copia(a), aprobador: this.db.usuarios.find((u) => u.id === a.aprobador_id)?.nombre ?? null }));
  }

  async iniciarRonda(auditoriaId: number, niveles: NivelAprobacion[]) {
    this.db.aprobaciones = this.db.aprobaciones.filter((a) => a.auditoria_id !== auditoriaId);
    niveles.forEach((nivel, i) => this.db.aprobaciones.push({
      id: this.db.siguienteId('aprobaciones'), auditoria_id: auditoriaId, secuencia: i + 1, nivel, aprobador_id: null,
      decision: 'pendiente', comentarios: null, fecha_decision: null, zona_horaria: null,
    }));
  }

  async registrarDecision(aprobacionId: number, cambios: Pick<Aprobacion, 'decision' | 'aprobador_id' | 'comentarios' | 'zona_horaria'>) {
    const a = this.db.aprobaciones.find((x) => x.id === aprobacionId);
    if (a) Object.assign(a, cambios, { fecha_decision: new Date(new Date().toISOString().slice(0, 19) + 'Z') });
  }

  async cierre(auditoriaId: number) {
    return copia(this.db.cierres.find((c) => c.auditoria_id === auditoriaId) ?? null);
  }

  async guardarCierre(cierre: Omit<Cierre, 'id'>) {
    if (this.db.cierres.some((c) => c.auditoria_id === cierre.auditoria_id)) {
      throw new ConflictException('El sello de cierre es inmutable.');
    }
    this.db.cierres.push({ ...cierre, id: this.db.siguienteId('cierres') });
  }

  async notificar(usuarioId: number, auditoriaId: number, tipo: string, mensaje: string) {
    this.db.notificaciones.push({
      id: this.db.siguienteId('notificaciones'), usuario_id: usuarioId, plan_id: null, auditoria_id: auditoriaId, tipo,
      mensaje: mensaje.slice(0, 500), canal: 'plataforma', fecha_programada: null, fecha_envio: new Date(), leida: false,
    });
  }
}
