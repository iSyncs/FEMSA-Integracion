import { Injectable } from "@nestjs/common";
import { ConexionSql, siguienteFolio } from "./conexion-sql";
import { DocumentoLote, Lote, LotesRepository, NuevoLote } from "../repositorios/lotes.repository";

/** Tablas dbo.IA_LOTE e IA_LOTE_EVIDENCE (script: datos/sql/scripts/ia_lote.sql). */
const SQL_LOTE = `
  SELECT l.lote_id AS id, l.tracking_id, l.audit_id AS auditoria_id, a.tracking_id AS auditoria_folio, a.name AS auditoria,
         l.request_pbc_id AS solicitud_pbc_id, l.sent_by AS enviado_por_id, u.full_name AS enviado_por, l.subject AS asunto,
         l.state AS estado, l.total_docs AS total, l.analyzed_docs AS analizados, l.error,
         l.created_at AS recibido, l.started_at AS inicio, l.finished_at AS fin
    FROM dbo.IA_LOTE l
    JOIN dbo.AUDIT a ON a.audit_id = l.audit_id
    JOIN dbo.[USER] u ON u.user_id = l.sent_by`;

@Injectable()
export class LotesSqlRepository extends LotesRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  private async conDocumentos(lotes: Omit<Lote, "documentos">[]): Promise<Lote[]> {
    if (!lotes.length) return [];
    const docs = await this.db.consulta<DocumentoLote & { lote_id: number }>(`
      SELECT le.lote_id, e.evidence_id AS id, e.tracking_id, e.file_name AS nombre_archivo, e.mime_type AS tipo_mime
        FROM dbo.IA_LOTE_EVIDENCE le JOIN dbo.EVIDENCE e ON e.evidence_id = le.evidence_id
       WHERE le.lote_id IN (${lotes.map((l) => Number(l.id)).join(",")}) ORDER BY e.evidence_id`);
    return lotes.map((l) => ({
      ...l,
      documentos: docs.filter((d) => d.lote_id === l.id).map(({ lote_id: _l, ...d }) => d),
    }));
  }

  async crear(d: NuevoLote) {
    const id = await this.db.transaccion(async (tx) => {
      const tracking = await siguienteFolio(tx, "IA_LOTE", "LOT");
      const [f] = await tx.consulta<{ id: number }>(
        `
        INSERT INTO dbo.IA_LOTE (tracking_id, audit_id, request_pbc_id, sent_by, subject, total_docs)
        OUTPUT INSERTED.lote_id AS id
        VALUES (@tracking, @auditoria, @pbc, @usuario, @asunto, @total)`,
        {
          tracking,
          auditoria: d.auditoriaId,
          pbc: d.solicitudPbcId,
          usuario: d.enviadoPor,
          asunto: d.asunto,
          total: d.evidencias.length,
        },
      );
      for (const evidencia of d.evidencias) {
        await tx.consulta("INSERT INTO dbo.IA_LOTE_EVIDENCE (lote_id, evidence_id) VALUES (@lote, @evidencia)", {
          lote: f.id,
          evidencia,
        });
      }
      return f.id;
    });
    return (await this.buscar(id))!;
  }

  async listar() {
    return this.conDocumentos(await this.db.consulta<Omit<Lote, "documentos">>(`${SQL_LOTE} ORDER BY l.lote_id DESC`));
  }

  async buscar(id: number) {
    const [l] = await this.conDocumentos(
      await this.db.consulta<Omit<Lote, "documentos">>(`${SQL_LOTE} WHERE l.lote_id = @id`, { id }),
    );
    return l ?? null;
  }

  async actualizar(id: number, c: Partial<Pick<Lote, "estado" | "analizados" | "error" | "inicio" | "fin">>) {
    const columnas: Record<string, string> = {
      estado: "state",
      analizados: "analyzed_docs",
      error: "error",
      inicio: "started_at",
      fin: "finished_at",
    };
    const sets = Object.keys(c)
      .filter((k) => k in columnas)
      .map((k) => `${columnas[k]} = @${k}`);
    if (!sets.length) return;
    await this.db.consulta(`UPDATE dbo.IA_LOTE SET ${sets.join(", ")} WHERE lote_id = @id`, { ...c, id });
  }

  async enLote(evidencias: number[]) {
    if (!evidencias.length) return [];
    const filas = await this.db.consulta<{ id: number }>(
      `SELECT evidence_id AS id FROM dbo.IA_LOTE_EVIDENCE WHERE evidence_id IN (${evidencias.map(Number).join(",")})`,
    );
    return filas.map((f) => f.id);
  }
}
