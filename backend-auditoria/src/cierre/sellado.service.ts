import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { HallazgosRepository } from '../datos/repositorios/hallazgos.repository';
import { CierreRepository } from '../datos/repositorios/cierre.repository';
import { UsuariosRepository } from '../datos/repositorios/usuarios.repository';
import { canonico, sha256 } from '../common/utils/hash';

/** HU_08 · Cierre e inmutabilidad: manifiesto canónico + SHA-256 + sello de tiempo UTC. */
@Injectable()
export class SelladoService implements OnApplicationBootstrap {
  constructor(
    private readonly auditorias: AuditoriasRepository,
    private readonly hallazgos: HallazgosRepository,
    private readonly cierre: CierreRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  /** Sella al arrancar los expedientes con las tres firmas y sin sello (datos de demostración). */
  async onApplicationBootstrap() {
    for (const a of await this.auditorias.listar()) {
      if (a.estado !== 'en_aprobacion' || (await this.cierre.cierre(a.id))) continue;
      const firmas = await this.cierre.aprobaciones(a.id);
      const director = firmas.find((f) => f.nivel === 'director');
      if (firmas.length && firmas.every((f) => f.decision === 'aprobado') && director?.aprobador_id) {
        await this.sellar(a.id, director.aprobador_id);
      }
    }
  }

  async construirManifiesto(auditoriaId: number, selladoEn: Date) {
    const [a, procedimientos, hallazgos, evidencias, aprobaciones] = await Promise.all([
      this.auditorias.buscar(auditoriaId),
      this.auditorias.procedimientos(auditoriaId),
      this.hallazgos.porAuditoria(auditoriaId),
      this.auditorias.evidencias(auditoriaId),
      this.cierre.aprobaciones(auditoriaId),
    ]);
    const lider = a ? await this.usuarios.buscarActivo(a.lider_id) : null;
    return {
      version: 1,
      selladoEn,
      auditoria: a && {
        tracking_id: a.tracking_id, nombre: a.nombre, objetivo: a.objetivo, tipo: a.tipo, area: a.area, prioridad: a.prioridad,
        fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin, unidad_negocio: a.unidad, lider: lider?.correo ?? null,
      },
      procedimientos: procedimientos.map((p) => ({
        tracking_id: p.tracking_id, control: p.control_folio, estado: p.estado, calif_diseno: p.calif_diseno,
        calif_efectividad: p.calif_efectividad, vulnerabilidad: p.vulnerabilidad, comentarios: p.comentarios, fecha_evaluacion: p.fecha_evaluacion,
      })),
      hallazgos: hallazgos.map((h) => ({
        tracking_id: h.tracking_id, titulo: h.titulo, condicion: h.condicion, criterio: h.criterio, causa: h.causa, efecto: h.efecto,
        recomendacion: h.recomendacion, severidad: h.severidad, tipo: h.tipo, fecha_identificacion: h.fecha_identificacion,
      })),
      evidencias: evidencias.map((e) => ({ tracking_id: e.tracking_id, nombre_archivo: e.nombre_archivo, hash_sha256: e.hash_sha256 })),
      aprobaciones: aprobaciones.map((x) => ({ secuencia: x.secuencia, nivel: x.nivel, aprobador: x.aprobador, decision: x.decision, fecha_decision: x.fecha_decision })),
    };
  }

  async sellar(auditoriaId: number, usuarioId: number) {
    const selladoEn = new Date();
    const manifiesto = canonico(await this.construirManifiesto(auditoriaId, selladoEn));
    const hash = sha256(manifiesto);
    await this.auditorias.cambiarEstado(auditoriaId, 'cerrada');
    await this.cierre.guardarCierre({
      auditoria_id: auditoriaId, cerrado_por_id: usuarioId, sello_temporal: selladoEn, algoritmo: 'SHA-256',
      hash_integridad: hash, manifiesto, firma: null,
    });
    return { hash, selladoEn };
  }

  async verificar(auditoriaId: number) {
    const c = await this.cierre.cierre(auditoriaId);
    if (!c) return null;
    const selladoEn = new Date(JSON.parse(c.manifiesto).selladoEn);
    const actual = sha256(canonico(await this.construirManifiesto(auditoriaId, selladoEn)));
    return {
      hashGuardado: c.hash_integridad,
      hashRecalculado: actual,
      manifiestoIntacto: sha256(c.manifiesto) === c.hash_integridad,
      datosIntactos: actual === c.hash_integridad,
      selloTemporal: c.sello_temporal,
    };
  }
}
