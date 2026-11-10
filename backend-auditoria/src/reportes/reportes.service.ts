import { Injectable } from "@nestjs/common";
import { AccesoService, conAvance } from "../auth/acceso.service";
import { AuditoriasRepository } from "../datos/repositorios/auditorias.repository";
import { HallazgosRepository } from "../datos/repositorios/hallazgos.repository";
import { CierreRepository } from "../datos/repositorios/cierre.repository";
import { PlanesRepository } from "../datos/repositorios/planes.repository";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import {
  SEMAFOROS,
  SEVERIDADES,
  TIPOS,
  contarPor,
  cumplimiento,
  diasEntre,
  hallazgoAbierto,
  ordenarPorSeveridad,
  porSemana,
  semaforo,
} from "./agregados";

const MAX_LISTA = 10;

/** HU_14 · Indicadores agregados con la misma seguridad por rol y por fila que los listados. */
@Injectable()
export class ReportesService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly auditorias: AuditoriasRepository,
    private readonly hallazgos: HallazgosRepository,
    private readonly planes: PlanesRepository,
    private readonly cierre: CierreRepository,
  ) {}

  async resumen(usuario: UsuarioSesion, ahora: Date = new Date()) {
    const [visible, auds, hs, pls] = await Promise.all([
      this.acceso.filtro(usuario),
      this.auditorias.listar(),
      this.hallazgos.listar(),
      this.planes.listar(),
    ]);
    const soloPropios = usuario.rol === "auditado";
    const auditorias = auds.filter(visible);
    const hallazgos = hs.filter((h) => visible(h) && (!soloPropios || h.responsable_id === usuario.id));
    const planes = pls.filter((p) => visible(p) && (!soloPropios || p.responsable_id === usuario.id));

    const procedimientos = await this.auditorias.procedimientosPorEstado(auditorias.map((a) => a.id));
    const totalProcedimientos = Object.values(procedimientos).reduce((s, n) => s + n, 0);
    const abiertos = hallazgos.filter(hallazgoAbierto);

    const conSemaforo = planes.map((p) => ({ plan: p, ...semaforo(p, ahora) }));

    return {
      cumplimiento: cumplimiento(procedimientos.supervisado, totalProcedimientos),
      procedimientos,
      hallazgos: {
        total: hallazgos.length,
        abiertos: abiertos.length,
        impactoMxn: abiertos.reduce((s, h) => s + (h.impacto_mxn ?? 0), 0),
        porSeveridad: contarPor(hallazgos, SEVERIDADES, (h) => h.severidad).map(({ clave, total }) => ({
          severidad: clave,
          total,
        })),
        porTipo: contarPor(hallazgos, TIPOS, (h) => h.tipo).map(({ clave, total }) => ({ tipo: clave, total })),
        porSemana: porSemana(
          hallazgos.map((h) => h.fecha_identificacion),
          ahora,
        ),
        // Misma serie semanal separada por severidad, para filtrar la gráfica del tablero.
        porSemanaSeveridad: Object.fromEntries(
          SEVERIDADES.map((sev) => [
            sev,
            porSemana(
              hallazgos.filter((h) => h.severidad === sev).map((h) => h.fecha_identificacion),
              ahora,
            ),
          ]),
        ),
      },
      planes: {
        total: planes.length,
        porSemaforo: contarPor(conSemaforo, SEMAFOROS, (x) => x.semaforo).map(({ clave, total }) => ({
          semaforo: clave,
          total,
        })),
        proximos: conSemaforo
          .filter((x) => x.semaforo !== "cerrado" && x.plan.avance_pct < 100)
          .map(({ plan: p, semaforo: s, diasRestantes }) => ({
            id: p.id,
            tracking_id: p.tracking_id,
            auditoria_folio: p.auditoria_folio,
            descripcion: p.descripcion,
            responsable: p.responsable,
            fecha_compromiso: p.fecha_compromiso,
            diasRestantes,
            semaforo: s,
          })),
      },
    };
  }

  /**
   * HU_13 · Datos del informe ejecutivo: los indicadores del tablero más las listas que lleva el PDF
   * (auditorías, hallazgos principales, planes demorados y expedientes sellados), con la misma seguridad por fila.
   */
  async ejecutivo(usuario: UsuarioSesion, ahora: Date = new Date()) {
    const r = await this.resumen(usuario, ahora);
    const [visible, auds, hs] = await Promise.all([
      this.acceso.filtro(usuario),
      this.auditorias.listar(),
      this.hallazgos.listar(),
    ]);
    const auditorias = auds.filter(visible);
    const porEstado = Object.fromEntries(
      ["pendiente", "en_ejecucion", "en_aprobacion", "cerrada"].map((e) => [
        e,
        auditorias.filter((a) => a.estado === e).length,
      ]),
    );
    const sellados = (
      await Promise.all(
        auditorias.filter((a) => a.estado === "cerrada").map(async (a) => ({ a, c: await this.cierre.cierre(a.id) })),
      )
    )
      .filter(({ c }) => c)
      .map(({ a, c }) => ({
        tracking_id: a.tracking_id,
        nombre: a.nombre,
        sello_temporal: c!.sello_temporal,
        hash_integridad: c!.hash_integridad,
      }));
    const principales = ordenarPorSeveridad(hs.filter((h) => visible(h) && hallazgoAbierto(h)))
      .slice(0, 15)
      .map((h) => ({
        tracking_id: h.tracking_id,
        titulo: h.titulo,
        severidad: h.severidad,
        auditoria_folio: h.auditoria_folio,
        impacto_mxn: h.impacto_mxn,
        responsable: h.responsable,
        planes: h.planes,
        dias_abierto: diasEntre(h.fecha_identificacion, ahora),
      }));
    return {
      generadoEn: ahora,
      generadoPor: usuario.nombre,
      cumplimiento: r.cumplimiento,
      procedimientos: r.procedimientos,
      auditorias: {
        total: auditorias.length,
        ...porEstado,
        lista: auditorias.map(conAvance).map((a) => ({
          tracking_id: a.tracking_id,
          nombre: a.nombre,
          unidad: a.unidad,
          estado: a.estado,
          avance: a.avance,
          hallazgos_abiertos: a.hallazgos_abiertos,
          hallazgos_criticos: a.hallazgos_criticos,
          lider: a.lider,
        })),
      },
      hallazgos: {
        total: r.hallazgos.total,
        abiertos: r.hallazgos.abiertos,
        impactoMxn: r.hallazgos.impactoMxn,
        porSeveridad: r.hallazgos.porSeveridad,
        principales,
      },
      planes: {
        total: r.planes.total,
        porSemaforo: r.planes.porSemaforo,
        demorados: r.planes.proximos.filter((p) => p.semaforo === "demorado"),
      },
      expedientesSellados: sellados,
    };
  }

  /** HU_14 · Dónde se atora el trabajo. El auditado no ve procedimientos ni aprobaciones (igual que el expediente). */
  async cuellosDeBotella(usuario: UsuarioSesion, ahora: Date = new Date()) {
    const soloPropios = usuario.rol === "auditado";
    const [visible, auds, hs] = await Promise.all([
      this.acceso.filtro(usuario),
      this.auditorias.listar(),
      this.hallazgos.listar(),
    ]);
    const auditorias = auds.filter(visible);
    const abiertas = soloPropios ? [] : auditorias.filter((a) => a.estado !== "cerrada");

    const [rondas, procs] = await Promise.all([
      Promise.all(
        abiertas
          .filter((a) => a.estado === "en_aprobacion")
          .map(async (a) => ({ a, firmas: await this.cierre.aprobaciones(a.id) })),
      ),
      Promise.all(abiertas.map(async (a) => (await this.auditorias.procedimientos(a.id)).map((p) => ({ a, p })))),
    ]);

    const aprobaciones = rondas
      .flatMap(({ a, firmas }) => {
        const i = firmas.findIndex((f) => f.decision === "pendiente");
        if (i < 0) return [];
        return [
          {
            auditoria_id: a.id,
            tracking_id: a.tracking_id,
            auditoria: a.nombre,
            nivelPendiente: firmas[i].nivel,
            diasEnNivel: diasEntre(firmas[i - 1]?.fecha_decision, ahora),
          },
        ];
      })
      .sort((x, y) => (y.diasEnNivel ?? -1) - (x.diasEnNivel ?? -1));

    const procedimientos = procs
      .flat()
      .filter(({ p }) => p.estado !== "supervisado")
      .map(({ a, p }) => ({
        tracking_id: p.tracking_id,
        auditoria_folio: a.tracking_id,
        control: p.control,
        estado: p.estado,
        auditor: p.auditor,
        diasSinMovimiento: diasEntre(p.fecha_evaluacion, ahora),
      }))
      .sort((x, y) => (y.diasSinMovimiento ?? Infinity) - (x.diasSinMovimiento ?? Infinity));

    const sinPlan = ordenarPorSeveridad(
      hs.filter(
        (h) => visible(h) && (!soloPropios || h.responsable_id === usuario.id) && hallazgoAbierto(h) && h.planes === 0,
      ),
    ).map((h) => ({
      id: h.id,
      tracking_id: h.tracking_id,
      titulo: h.titulo,
      severidad: h.severidad,
      auditoria_folio: h.auditoria_folio,
      diasAbierto: diasEntre(h.fecha_identificacion, ahora)!,
    }));

    return {
      resumen: {
        auditoriasEnAprobacion: aprobaciones.length,
        procedimientosEstancados: procedimientos.length,
        hallazgosSinPlan: sinPlan.length,
      },
      aprobaciones,
      procedimientos: procedimientos.slice(0, MAX_LISTA),
      hallazgosSinPlan: sinPlan.slice(0, MAX_LISTA),
    };
  }
}
