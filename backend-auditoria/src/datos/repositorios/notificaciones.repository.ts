/**
 * HU_12 · Notificaciones dentro de la plataforma (tabla dbo.NOTIFICATION).
 * El canal de correo queda para después: hoy todo se guarda con canal 'plataforma'.
 */
export interface NuevaNotificacion {
  usuarioId: number; tipo: string; mensaje: string; planId?: number | null; auditoriaId?: number | null;
}

export interface NotificacionVista {
  id: number; usuario_id: number; tipo: string; mensaje: string; fecha: Date; leida: boolean;
  plan_id: number | null; plan_folio: string | null; auditoria_id: number | null; auditoria_folio: string | null;
}

export abstract class NotificacionesRepository {
  abstract crear(n: NuevaNotificacion): Promise<void>;
  /** Las más recientes primero. */
  abstract listar(usuarioId: number, limite: number): Promise<NotificacionVista[]>;
  abstract noLeidas(usuarioId: number): Promise<number>;
  /** Devuelve false si la notificación no existe o es de otro usuario. */
  abstract marcarLeida(id: number, usuarioId: number): Promise<boolean>;
  abstract marcarTodas(usuarioId: number): Promise<void>;
  /** Evita repetir un aviso de vencimiento que ya se mandó para ese plan. */
  abstract yaEnviada(usuarioId: number, planId: number, tipo: string): Promise<boolean>;
  /** Igual, para avisos sin plan (solicitudes PBC): se busca el folio dentro del mensaje. */
  abstract yaEnviadaConFolio(usuarioId: number, tipo: string, folio: string): Promise<boolean>;
}
