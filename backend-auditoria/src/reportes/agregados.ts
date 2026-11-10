import type { Hallazgo, Severidad, TipoHallazgo } from '../datos/modelos';
import { semaforo, type Semaforo } from '../planes/semaforo';

export const SEVERIDADES: Severidad[] = ['Crítica', 'Alta', 'Moderada', 'Baja'];
export const TIPOS: TipoHallazgo[] = ['Debilidad de control', 'Debilidad menor'];
export const SEMAFOROS: Semaforo[] = ['en_tiempo', 'por_vencer', 'demorado', 'cerrado'];
export const SEMANAS = 8;
const MS_SEMANA = 7 * 86_400_000;

export const hallazgoAbierto = (h: Pick<Hallazgo, 'estado'>) => h.estado !== 'solventado' && h.estado !== 'rechazado';

/** Cuenta por clave y devuelve siempre todas las claves esperadas (en ese orden), aunque tengan 0. */
export function contarPor<T, K extends string>(items: T[], claves: readonly K[], clave: (x: T) => K) {
  const cuenta = new Map<K, number>(claves.map((k) => [k, 0]));
  for (const x of items) cuenta.set(clave(x), (cuenta.get(clave(x)) ?? 0) + 1);
  return claves.map((k) => ({ clave: k, total: cuenta.get(k)! }));
}

/** Hallazgos por semana de identificación: `semanasAtras` va de SEMANAS-1 a 0 (0 = esta semana). */
export function porSemana(fechas: Date[], ahora: Date = new Date()) {
  const cubos = Array.from({ length: SEMANAS }, (_, i) => ({ semanasAtras: SEMANAS - 1 - i, total: 0 }));
  for (const f of fechas) {
    const atras = Math.max(0, Math.floor((ahora.getTime() - f.getTime()) / MS_SEMANA));
    if (atras < SEMANAS) cubos[SEMANAS - 1 - atras].total++;
  }
  return cubos;
}

export const cumplimiento = (supervisados: number, total: number) => (total ? Math.round((supervisados / total) * 100) : 0);

export { semaforo };

const MS_DIA = 86_400_000;

/** Días completos entre dos fechas; null si falta el punto de partida. */
export const diasEntre = (desde: Date | null | undefined, hasta: Date): number | null =>
  desde ? Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / MS_DIA)) : null;

/** Crítica primero; a igualdad, el más antiguo primero. */
export const ordenarPorSeveridad = <T extends { severidad: Severidad; fecha_identificacion: Date }>(xs: T[]): T[] =>
  [...xs].sort((a, b) =>
    SEVERIDADES.indexOf(a.severidad) - SEVERIDADES.indexOf(b.severidad)
    || a.fecha_identificacion.getTime() - b.fecha_identificacion.getTime());
