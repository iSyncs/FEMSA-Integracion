/**
 * Análisis de IA guardados (uno por evidencia). El resultado completo (documento clasificado, faltantes y
 * borradores con su estado) se guarda como JSON: así sobrevive a reinicios del servidor y evita repetir
 * la llamada a la IA para la misma evidencia.
 */
export interface AnalisisGuardado<P = unknown> {
  id: number;
  auditoriaId: number;
  evidenciaId: number;
  lote: string;
  contenido: P;
}

export abstract class SugerenciasIaRepository {
  abstract listar<P>(): Promise<AnalisisGuardado<P>[]>;
  abstract buscar<P>(auditoriaId: number, evidenciaId: number): Promise<AnalisisGuardado<P> | null>;
  abstract buscarPorId<P>(id: number): Promise<AnalisisGuardado<P> | null>;
  abstract guardar<P>(datos: Omit<AnalisisGuardado<P>, 'id'> & { usuarioId: number }): Promise<AnalisisGuardado<P>>;
  abstract actualizar<P>(id: number, contenido: P): Promise<void>;
}
