import { Injectable } from "@nestjs/common";
import { ConexionSql, siguienteFolio } from "./conexion-sql";
import { CambiosSolicitudPbc, NuevaSolicitudPbc, PbcRepository, SolicitudPbc } from "../repositorios/pbc.repository";
import type { EstadoPuntoPbc, PuntoPbc } from "../modelos";

/** Tablas dbo.REQUEST_PBC y dbo.REQUEST_PBC_ITEM (migración: db/migrations/006-request-pbc-detalle.sql). */
const SQL_SOLICITUD = `
  SELECT r.request_pbc_id AS id, r.tracking_id, r.procedure_id AS procedimiento_id, r.state AS estado, r.subject AS asunto,
         r.requested_by AS solicitado_por_id, r.requested_to AS solicitado_a_id, r.due_date AS fecha_limite, r.created_at AS creado,
         r.sent_at AS enviado, r.closed_at AS cerrado, r.review_comment AS comentario_revision,
         p.audit_id AS auditoria_id, a.tracking_id AS auditoria_folio, a.name AS auditoria, p.tracking_id AS procedimiento, c.name AS control,
         up.full_name AS solicitado_por, ua.full_name AS solicitado_a
    FROM dbo.REQUEST_PBC r
    JOIN dbo.[PROCEDURE] p ON p.procedure_id = r.procedure_id
    JOIN dbo.AUDIT a ON a.audit_id = p.audit_id
    JOIN dbo.CONTROL c ON c.control_id = p.control_id
    LEFT JOIN dbo.[USER] up ON up.user_id = r.requested_by
    LEFT JOIN dbo.[USER] ua ON ua.user_id = r.requested_to`;

const COLUMNAS: Record<keyof CambiosSolicitudPbc, string> = {
  estado: "state",
  enviado: "sent_at",
  cerrado: "closed_at",
  comentario_revision: "review_comment",
};

@Injectable()
export class PbcSqlRepository extends PbcRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  private async conPuntos(filas: Omit<SolicitudPbc, "puntos">[]): Promise<SolicitudPbc[]> {
    if (!filas.length) return [];
    const puntos = await this.db.consulta<PuntoPbc>(`
      SELECT request_pbc_item_id AS id, request_pbc_id AS solicitud_id, description AS descripcion,
             CAST(is_required AS bit) AS obligatorio, state AS estado, sort_order AS orden
        FROM dbo.REQUEST_PBC_ITEM WHERE request_pbc_id IN (${filas.map((f) => Number(f.id)).join(",")}) ORDER BY sort_order`);
    return filas.map((f) => ({
      ...f,
      puntos: puntos.filter((p) => p.solicitud_id === f.id).map((p) => ({ ...p, obligatorio: !!p.obligatorio })),
    }));
  }

  async listar(auditoriaId?: number) {
    const filas = await this.db.consulta<Omit<SolicitudPbc, "puntos">>(
      `${SQL_SOLICITUD} ${auditoriaId ? "WHERE p.audit_id = @auditoriaId" : ""} ORDER BY r.request_pbc_id DESC`,
      { auditoriaId },
    );
    return this.conPuntos(filas);
  }

  async buscar(id: number) {
    const [s] = await this.conPuntos(
      await this.db.consulta<Omit<SolicitudPbc, "puntos">>(`${SQL_SOLICITUD} WHERE r.request_pbc_id = @id`, { id }),
    );
    return s ?? null;
  }

  async crear(d: NuevaSolicitudPbc) {
    return this.db.transaccion(async (tx) => {
      const tracking = await siguienteFolio(tx, "REQUEST_PBC", "PBC");
      const [r] = await tx.consulta<{ id: number }>(
        `
        INSERT INTO dbo.REQUEST_PBC (state, procedure_id, tracking_id, requested_by, requested_to, subject, due_date)
        OUTPUT INSERTED.request_pbc_id AS id
        VALUES ('solicitada', @procedimiento, @tracking, @por, @a, @asunto, @limite)`,
        {
          procedimiento: d.procedimientoId,
          tracking,
          por: d.solicitadoPorId,
          a: d.solicitadoAId,
          asunto: d.asunto,
          limite: d.fechaLimite,
        },
      );
      for (const [i, p] of d.puntos.entries()) {
        await tx.consulta(
          `
          INSERT INTO dbo.REQUEST_PBC_ITEM (request_pbc_id, description, is_required, sort_order)
          VALUES (@solicitud, @descripcion, @obligatorio, @orden)`,
          { solicitud: r.id, descripcion: p.descripcion, obligatorio: p.obligatorio, orden: i + 1 },
        );
      }
      return r.id;
    });
  }

  async actualizar(id: number, c: CambiosSolicitudPbc) {
    const campos = (Object.keys(c) as (keyof CambiosSolicitudPbc)[]).filter((k) => k in COLUMNAS);
    if (!campos.length) return;
    await this.db.consulta(
      `UPDATE dbo.REQUEST_PBC SET ${campos.map((k) => `${COLUMNAS[k]} = @${k}`).join(", ")} WHERE request_pbc_id = @id`,
      { ...c, id },
    );
  }

  async marcarPuntos(solicitudId: number, puntos: { id: number; estado: EstadoPuntoPbc }[]) {
    for (const p of puntos) {
      await this.db.consulta(
        "UPDATE dbo.REQUEST_PBC_ITEM SET state = @estado WHERE request_pbc_item_id = @id AND request_pbc_id = @solicitud",
        { id: p.id, estado: p.estado, solicitud: solicitudId },
      );
    }
  }
}
