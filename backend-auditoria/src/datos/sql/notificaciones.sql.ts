import { Injectable } from "@nestjs/common";
import { ConexionSql } from "./conexion-sql";
import {
  NotificacionesRepository,
  NotificacionVista,
  NuevaNotificacion,
} from "../repositorios/notificaciones.repository";

/** dbo.NOTIFICATION no tiene created_at: sent_at es la fecha del aviso. La auditoría sale del plan cuando no viene directa. */
const SQL_NOTIFICACION = `
  SELECT n.notification_id AS id, n.user_id AS usuario_id, n.type AS tipo, ISNULL(n.message, '') AS mensaje,
         ISNULL(n.sent_at, n.scheduled_at) AS fecha, CAST(n.is_read AS bit) AS leida,
         n.remediation_plan_id AS plan_id, rp.tracking_id AS plan_folio,
         COALESCE(n.audit_id, f.audit_id) AS auditoria_id, a.tracking_id AS auditoria_folio
    FROM dbo.NOTIFICATION n
    LEFT JOIN dbo.REMEDIATION_PLAN rp ON rp.remediation_plan_id = n.remediation_plan_id
    LEFT JOIN dbo.FINDING f ON f.finding_id = rp.finding_id
    LEFT JOIN dbo.AUDIT a ON a.audit_id = COALESCE(n.audit_id, f.audit_id)`;

@Injectable()
export class NotificacionesSqlRepository extends NotificacionesRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async crear(n: NuevaNotificacion) {
    await this.db.consulta(
      `
      INSERT INTO dbo.NOTIFICATION (type, remediation_plan_id, user_id, audit_id, message, channel, sent_at)
      VALUES (@tipo, @plan, @usuario, @auditoria, @mensaje, 'plataforma', SYSUTCDATETIME())`,
      {
        tipo: n.tipo,
        plan: n.planId ?? null,
        usuario: n.usuarioId,
        auditoria: n.auditoriaId ?? null,
        mensaje: n.mensaje.slice(0, 500),
      },
    );
  }

  async listar(usuarioId: number, limite: number) {
    const filas = await this.db.consulta<NotificacionVista>(
      `${SQL_NOTIFICACION} WHERE n.user_id = @usuarioId ORDER BY n.notification_id DESC OFFSET 0 ROWS FETCH NEXT @limite ROWS ONLY`,
      { usuarioId, limite },
    );
    return filas.map((f) => ({ ...f, leida: !!f.leida }));
  }

  async noLeidas(usuarioId: number) {
    const [f] = await this.db.consulta<{ n: number }>(
      "SELECT COUNT(*) AS n FROM dbo.NOTIFICATION WHERE user_id = @usuarioId AND is_read = 0",
      { usuarioId },
    );
    return f?.n ?? 0;
  }

  async marcarLeida(id: number, usuarioId: number) {
    const filas = await this.db.consulta<{ id: number }>(
      `
      UPDATE dbo.NOTIFICATION SET is_read = 1 OUTPUT INSERTED.notification_id AS id
       WHERE notification_id = @id AND user_id = @usuarioId`,
      { id, usuarioId },
    );
    return filas.length > 0;
  }

  async marcarTodas(usuarioId: number) {
    await this.db.consulta("UPDATE dbo.NOTIFICATION SET is_read = 1 WHERE user_id = @usuarioId AND is_read = 0", {
      usuarioId,
    });
  }

  async yaEnviadaConFolio(usuarioId: number, tipo: string, folio: string) {
    const [f] = await this.db.consulta<{ n: number }>(
      `
      SELECT COUNT(*) AS n FROM dbo.NOTIFICATION
       WHERE user_id = @usuarioId AND type = @tipo AND message LIKE @patron`,
      { usuarioId, tipo, patron: `%${folio}%` },
    );
    return (f?.n ?? 0) > 0;
  }

  async yaEnviada(usuarioId: number, planId: number, tipo: string) {
    const [f] = await this.db.consulta<{ n: number }>(
      `
      SELECT COUNT(*) AS n FROM dbo.NOTIFICATION
       WHERE user_id = @usuarioId AND remediation_plan_id = @planId AND type = @tipo`,
      { usuarioId, planId, tipo },
    );
    return (f?.n ?? 0) > 0;
  }
}
