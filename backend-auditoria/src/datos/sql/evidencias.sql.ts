import { Injectable } from "@nestjs/common";
import { ConexionSql, siguienteFolio } from "./conexion-sql";
import {
  DestinoEvidencia,
  EvidenciaConAuditoria,
  EvidenciaHija,
  EvidenciasRepository,
  NuevaEvidencia,
} from "../repositorios/evidencias.repository";

@Injectable()
export class EvidenciasSqlRepository extends EvidenciasRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async destinoValido(d: DestinoEvidencia) {
    const [r] = await this.db.consulta<{ valido: number }>(
      `
      SELECT CASE WHEN
        (@procedimiento IS NOT NULL AND EXISTS (
          SELECT 1 FROM dbo.[PROCEDURE] WHERE procedure_id=@procedimiento AND audit_id=@auditoria))
        OR (@pbc IS NOT NULL AND EXISTS (
          SELECT 1 FROM dbo.REQUEST_PBC r JOIN dbo.[PROCEDURE] p ON p.procedure_id=r.procedure_id
           WHERE r.request_pbc_id=@pbc AND p.audit_id=@auditoria))
        THEN 1 ELSE 0 END AS valido`,
      {
        procedimiento: d.procedimientoId,
        pbc: d.solicitudPbcId,
        auditoria: d.auditoriaId,
      },
    );
    return Boolean(r?.valido);
  }

  async crear(d: NuevaEvidencia, hijas: EvidenciaHija[], reemplazaId?: number) {
    return this.db.transaccion(async (tx) => {
      const tracking = await siguienteFolio(tx, "EVIDENCE", "SOPORTE");
      const [r] = await tx.consulta<{ id: number; fecha: Date }>(
        `
        INSERT INTO dbo.EVIDENCE (tracking_id, parent_id, procedure_id, request_pbc_id, finding_id, file_name, blob_url, mime_type, size_bytes, sha256, uploaded_by, deleted)
        OUTPUT INSERTED.evidence_id AS id, INSERTED.uploaded_at AS fecha
        VALUES (@tracking, NULL, @procedimiento, @pbc, @hallazgo, @nombre, @blob, @mime, @tamano, @hash, @usuario, 0)`,
        {
          tracking,
          procedimiento: d.procedimiento_id,
          pbc: d.solicitud_pbc_id,
          hallazgo: d.hallazgo_id,
          nombre: d.nombre_archivo,
          blob: d.blob_url,
          mime: d.tipo_mime,
          tamano: d.tamano_bytes,
          hash: d.hash_sha256,
          usuario: d.cargado_por_id,
        },
      );
      for (const [i, h] of hijas.entries())
        await tx.consulta(
          `
        INSERT INTO dbo.EVIDENCE (tracking_id, parent_id, file_name, mime_type, size_bytes, sha256, uploaded_by, deleted)
        VALUES (@tracking, @padre, @nombre, @mime, @tamano, @hash, @usuario, 0)`,
          {
            tracking: `${tracking}-${String(i + 1).padStart(3, "0")}`,
            padre: r.id,
            nombre: h.nombre_archivo,
            mime: h.tipo_mime,
            tamano: h.tamano_bytes,
            hash: h.hash_sha256,
            usuario: d.cargado_por_id,
          },
        );
      if (reemplazaId)
        await tx.consulta("UPDATE dbo.EVIDENCE SET deleted=1 WHERE evidence_id=@id OR parent_id=@id", {
          id: reemplazaId,
        });
      const [audit] = await tx.consulta<{ auditoria_id: number }>(
        `
        SELECT COALESCE(p.audit_id, pp.audit_id) AS auditoria_id
          FROM dbo.EVIDENCE e
          LEFT JOIN dbo.[PROCEDURE] p ON p.procedure_id=e.procedure_id
          LEFT JOIN dbo.REQUEST_PBC q ON q.request_pbc_id=e.request_pbc_id
          LEFT JOIN dbo.[PROCEDURE] pp ON pp.procedure_id=q.procedure_id
         WHERE e.evidence_id=@id`,
        { id: r.id },
      );
      return {
        ...d,
        id: r.id,
        tracking_id: tracking,
        evidencia_padre_id: null,
        fecha_carga: r.fecha,
        eliminado: false,
        auditoria_id: audit.auditoria_id,
      } satisfies EvidenciaConAuditoria;
    });
  }

  async buscar(id: number) {
    const [r] = await this.db.consulta<EvidenciaConAuditoria>(
      `
      SELECT e.evidence_id AS id, e.tracking_id, e.parent_id AS evidencia_padre_id,
             e.procedure_id AS procedimiento_id, e.request_pbc_id AS solicitud_pbc_id, e.finding_id AS hallazgo_id,
             e.file_name AS nombre_archivo, COALESCE(e.blob_url, padre.blob_url) AS blob_url, e.mime_type AS tipo_mime,
             e.size_bytes AS tamano_bytes, e.sha256 AS hash_sha256, e.uploaded_by AS cargado_por_id,
             e.uploaded_at AS fecha_carga, e.deleted AS eliminado,
             COALESCE(p.audit_id, pp.audit_id) AS auditoria_id, u.full_name AS cargado_por
        FROM dbo.EVIDENCE e
        LEFT JOIN dbo.EVIDENCE padre ON padre.evidence_id=e.parent_id
        LEFT JOIN dbo.[PROCEDURE] p ON p.procedure_id=COALESCE(e.procedure_id,padre.procedure_id)
        LEFT JOIN dbo.REQUEST_PBC q ON q.request_pbc_id=COALESCE(e.request_pbc_id,padre.request_pbc_id)
        LEFT JOIN dbo.[PROCEDURE] pp ON pp.procedure_id=q.procedure_id
        LEFT JOIN dbo.[USER] u ON u.user_id=e.uploaded_by
       WHERE e.evidence_id=@id`,
      { id },
    );
    return r ?? null;
  }

  async marcarEliminada(id: number) {
    await this.db.consulta("UPDATE dbo.EVIDENCE SET deleted=1 WHERE evidence_id=@id OR parent_id=@id", { id });
  }
}
