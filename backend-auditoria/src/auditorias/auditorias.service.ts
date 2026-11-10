import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AccesoService, conAvance } from '../auth/acceso.service';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { CatalogosRepository } from '../datos/repositorios/usuarios.repository';
import { HallazgosRepository } from '../datos/repositorios/hallazgos.repository';
import { CierreRepository } from '../datos/repositorios/cierre.repository';
import { PrecierreService } from '../cierre/precierre.service';
import { prohibido } from '../common/errores';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { Contexto } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { CrearAuditoriaDto, EvaluarProcedimientoDto } from './auditorias.dto';

@Injectable()
export class AuditoriasService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly repo: AuditoriasRepository,
    private readonly catalogos: CatalogosRepository,
    private readonly hallazgos: HallazgosRepository,
    private readonly cierre: CierreRepository,
    private readonly precierre: PrecierreService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(usuario: UsuarioSesion) {
    const visible = await this.acceso.filtro(usuario);
    return (await this.repo.listar()).filter(visible).map(conAvance);
  }

  async crear(ctx: Contexto, dto: CrearAuditoriaDto) {
    if (dto.fechaInicio && dto.fechaFin && dto.fechaFin < dto.fechaInicio) {
      throw new UnprocessableEntityException({ error: 'Revisa los campos marcados.', detalles: { fechaFin: 'La fecha fin no puede ser anterior al inicio.' } });
    }
    const udn = await this.catalogos.unidad(dto.unidadNegocioId);
    if (!udn) throw new UnprocessableEntityException({ error: 'Revisa los campos marcados.', detalles: { unidadNegocioId: 'Unidad de negocio inexistente.' } });
    if (ctx.usuario.direccion && udn.direccion !== ctx.usuario.direccion) {
      throw prohibido(`Sólo puedes crear auditorías de la Dirección ${ctx.usuario.direccion}.`);
    }
    const a = await this.repo.crear({
      nombre: dto.nombre.trim(), objetivo: dto.objetivo.trim(), unidad_negocio_id: udn.id, tipo: dto.tipo, area: dto.area?.trim() || null,
      prioridad: dto.prioridad, lider_id: ctx.usuario.id,
      fecha_inicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null, fecha_fin: dto.fechaFin ? new Date(dto.fechaFin) : null,
    });
    await this.bitacora.registrarOperacion(ctx, { entidad: 'auditorias', entidadId: a.id, folio: a.tracking_id, accion: 'CREAR', nuevo: { nombre: a.nombre, estado: a.estado } });
    return this.acceso.auditoriaVisible(ctx.usuario, a.id);
  }

  async detalle(usuario: UsuarioSesion, id: number) {
    const a = await this.acceso.auditoriaVisible(usuario, id);
    const esAuditado = usuario.rol === 'auditado';
    const [procedimientos, hallazgos, aprobaciones, evidencias, cierre, precierre] = await Promise.all([
      esAuditado ? [] : this.repo.procedimientos(id),
      this.hallazgos.porAuditoria(id),
      this.cierre.aprobaciones(id),
      esAuditado ? [] : this.repo.evidencias(id),
      this.cierre.cierre(id),
      this.precierre.evaluar(id),
    ]);
    return {
      ...a,
      total_procedimientos: a.procedimientos,
      procedimientos: procedimientos.map((p) => ({
        id: p.id, tracking_id: p.tracking_id, auditor_id: p.auditor_id, estado: p.estado, calif_diseno: p.calif_diseno, calif_efectividad: p.calif_efectividad,
        vulnerabilidad: p.vulnerabilidad, comentarios: p.comentarios, fecha_evaluacion: p.fecha_evaluacion,
        avance: avanceProcedimiento(p.estado, !!p.calif_diseno || !!p.calif_efectividad || !!p.vulnerabilidad),
        control_folio: p.control_folio, control: p.control, riesgo_folio: p.riesgo_folio, riesgo: p.riesgo, auditor: p.auditor,
      })),
      hallazgos: hallazgos.map((h) => ({
        id: h.id, tracking_id: h.tracking_id, titulo: h.titulo, severidad: h.severidad, tipo: h.tipo, estado: h.estado,
        fecha_identificacion: h.fecha_identificacion, planes: h.planes, impacto_mxn: h.impacto_mxn, recomendacion: h.recomendacion,
      })),
      aprobaciones: aprobaciones.map((x) => ({
        secuencia: x.secuencia, nivel: x.nivel, decision: x.decision, comentarios: x.comentarios, fecha_decision: x.fecha_decision,
        zona_horaria: x.zona_horaria, aprobador: x.aprobador,
      })),
      evidencias: evidencias.map((e) => ({
        id: e.id, tracking_id: e.tracking_id, nombre_archivo: e.nombre_archivo, tipo_mime: e.tipo_mime, tamano_bytes: e.tamano_bytes,
        fecha_carga: e.fecha_carga, evidencia_padre_id: e.evidencia_padre_id, procedimiento_id: e.procedimiento_id,
        cargado_por_id: e.cargado_por_id, cargado_por: e.cargado_por, hash_sha256: e.hash_sha256,
      })),
      cierre: cierre && { sello_temporal: cierre.sello_temporal, hash_integridad: cierre.hash_integridad, algoritmo: cierre.algoritmo },
      precierre,
    };
  }


  async evaluarProcedimiento(ctx: Contexto, auditoriaId: number, procedimientoId: number, dto: EvaluarProcedimientoDto) {
    const auditoria = await this.acceso.auditoriaVisible(ctx.usuario, auditoriaId);
    if (auditoria.estado === 'cerrada') throw new ConflictException('Expediente cerrado: el procedimiento es de solo lectura.');
    const p = await this.repo.procedimiento(procedimientoId);
    if (!p || p.auditoria_id !== auditoriaId) throw new UnprocessableEntityException({
      error: 'Revisa los campos marcados.', detalles: { procedimientoId: 'El procedimiento no pertenece a la auditoría.' },
    });
    if (ctx.usuario.rol === 'auditor' && p.auditor_id !== ctx.usuario.id) throw prohibido('Sólo puedes evaluar controles que tienes asignados.');
    const actualizado = await this.repo.evaluarProcedimiento(procedimientoId, {
      calif_diseno: dto.diseno, calif_efectividad: dto.efectividad,
      vulnerabilidad: dto.vulnerabilidad, comentarios: dto.comentarios?.trim() || null,
    }, ctx);
    return { ...actualizado, avance: avanceProcedimiento(actualizado.estado, true) };
  }
}

export function avanceProcedimiento(estado: string, capturaIniciada = false): 0 | 20 | 40 | 70 | 80 | 100 {
  if (estado === 'supervisado') return 100;
  if (estado === 'revisado') return 80;
  if (estado === 'evaluado') return 70;
  if (estado === 'rechazado') return 40;
  return capturaIniciada ? 20 : 0;
}
