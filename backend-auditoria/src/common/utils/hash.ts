import { createHash } from 'node:crypto';

/** JSON canónico: llaves ordenadas y fechas ISO-8601 UTC, para que el hash sea reproducible. */
export function canonico(valor: unknown): string {
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
}

export const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');
