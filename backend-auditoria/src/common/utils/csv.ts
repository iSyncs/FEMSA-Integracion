/** Convierte un valor a celda CSV: fechas en ISO, objetos en JSON y comillas solo cuando hacen falta. */
export const celdaCsv = (v: unknown) => {
  const t =
    v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Archivo CSV con BOM (para que Excel respete los acentos), encabezado y una fila por registro. */
export const aCsv = (columnas: string[], filas: unknown[][]) =>
  `﻿${[columnas.join(","), ...filas.map((f) => f.map(celdaCsv).join(","))].join("\n")}\n`;

/** Columna de un CSV: nombre del encabezado y cómo sacar el valor de cada registro. */
export type ColumnaCsv<T> = [nombre: string, valor: (registro: T) => unknown];

/** Arma el CSV a partir de la lista de columnas, sin repetir el mapeo en cada exportación. */
export const csvDeColumnas = <T>(columnas: ColumnaCsv<T>[], registros: T[]) =>
  aCsv(
    columnas.map(([nombre]) => nombre),
    registros.map((r) => columnas.map(([, valor]) => valor(r))),
  );
