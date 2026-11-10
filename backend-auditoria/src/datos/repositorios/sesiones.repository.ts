/**
 * FE1S-37 · Sesiones del navegador. Solo se guarda el SHA-256 del token: quien lea la tabla no puede
 * reutilizar una sesión.
 */
export interface NuevaSesion {
  usuarioId: number; tokenHash: string; expira: Date; ip: string | null; agente: string | null;
}

export abstract class SesionesRepository {
  abstract crear(sesion: NuevaSesion): Promise<void>;
  /** Usuario de una sesión vigente (no revocada ni vencida), o null. */
  abstract usuarioDe(tokenHash: string, ahora: Date): Promise<number | null>;
  abstract revocar(tokenHash: string): Promise<void>;
}
