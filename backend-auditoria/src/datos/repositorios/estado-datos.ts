export interface InfoDatos { motor: string; base: string; edicion: string; tablas: number }

/** Qué fuente de datos está usando la API (para GET /api/health). */
export abstract class EstadoDatos {
  abstract estado(): Promise<InfoDatos>;
}
