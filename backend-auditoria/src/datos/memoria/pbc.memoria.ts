import { Injectable } from "@nestjs/common";
import { BaseDeDatosMemoria } from "./base-de-datos-memoria";
import { CambiosSolicitudPbc, NuevaSolicitudPbc, PbcRepository, SolicitudPbc } from "../repositorios/pbc.repository";
import type { EstadoPuntoPbc, SolicitudPbcRegistro } from "../modelos";

@Injectable()
export class PbcMemoriaRepository extends PbcRepository {
  constructor(private readonly db: BaseDeDatosMemoria) {
    super();
  }

  private vista(s: SolicitudPbcRegistro): SolicitudPbc | null {
    const p = this.db.procedimientos.find((x) => x.id === s.procedimiento_id);
    const a = this.db.auditorias.find((x) => x.id === p?.auditoria_id);
    if (!p || !a) return null;
    const nombre = (id: number | null) => this.db.usuarios.find((u) => u.id === id)?.nombre ?? null;
    return {
      ...structuredClone(s),
      auditoria_id: a.id,
      auditoria_folio: a.tracking_id,
      auditoria: a.nombre,
      procedimiento: p.tracking_id,
      control: this.db.controles.find((c) => c.id === p.control_id)?.nombre ?? "",
      solicitado_por: nombre(s.solicitado_por_id),
      solicitado_a: nombre(s.solicitado_a_id),
      puntos: this.db.puntosPbc
        .filter((x) => x.solicitud_id === s.id)
        .sort((x, y) => x.orden - y.orden)
        .map((x) => structuredClone(x)),
    };
  }

  async listar(auditoriaId?: number) {
    return [...this.db.solicitudesPbc]
      .sort((a, b) => b.id - a.id)
      .map((s) => this.vista(s))
      .filter((s): s is SolicitudPbc => !!s && (!auditoriaId || s.auditoria_id === auditoriaId));
  }

  async buscar(id: number) {
    const s = this.db.solicitudesPbc.find((x) => x.id === id);
    return s ? this.vista(s) : null;
  }

  async crear(d: NuevaSolicitudPbc) {
    const id = this.db.siguienteId("solicitudesPbc");
    this.db.solicitudesPbc.push({
      id,
      tracking_id: this.db.siguienteFolio("pbc"),
      procedimiento_id: d.procedimientoId,
      estado: "solicitada",
      asunto: d.asunto,
      solicitado_por_id: d.solicitadoPorId,
      solicitado_a_id: d.solicitadoAId,
      fecha_limite: d.fechaLimite,
      creado: new Date(),
      enviado: null,
      cerrado: null,
      comentario_revision: null,
    });
    d.puntos.forEach((p, i) => {
      this.db.puntosPbc.push({
        id: this.db.siguienteId("puntosPbc"),
        solicitud_id: id,
        descripcion: p.descripcion,
        obligatorio: p.obligatorio,
        estado: "pendiente",
        orden: i + 1,
      });
    });
    return id;
  }

  async actualizar(id: number, cambios: CambiosSolicitudPbc) {
    const s = this.db.solicitudesPbc.find((x) => x.id === id);
    if (s) Object.assign(s, cambios);
  }

  async marcarPuntos(solicitudId: number, puntos: { id: number; estado: EstadoPuntoPbc }[]) {
    for (const { id, estado } of puntos) {
      const p = this.db.puntosPbc.find((x) => x.id === id && x.solicitud_id === solicitudId);
      if (p) p.estado = estado;
    }
  }
}
