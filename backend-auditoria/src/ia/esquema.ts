/**
 * Validador mínimo de JSON Schema para las respuestas de la IA (FE1S-23).
 * Cubre lo que usan las skills: object, array, string, number, integer, boolean, enum,
 * required, minimum/maximum, minLength/maxLength y maxItems. Devuelve la lista de errores.
 */
export interface Esquema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, Esquema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Esquema;
  enum?: readonly (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
}

export function validar(valor: unknown, esquema: Esquema, ruta = "$"): string[] {
  const errores: string[] = [];
  const tipo = Array.isArray(valor) ? "array" : valor === null ? "null" : typeof valor;

  switch (esquema.type) {
    case "object": {
      if (tipo !== "object") return [`${ruta}: se esperaba un objeto`];
      const obj = valor as Record<string, unknown>;
      for (const k of esquema.required ?? []) if (!(k in obj)) errores.push(`${ruta}.${k}: falta`);
      for (const [k, sub] of Object.entries(esquema.properties ?? {}))
        if (k in obj) errores.push(...validar(obj[k], sub, `${ruta}.${k}`));
      if (esquema.additionalProperties === false) {
        for (const k of Object.keys(obj))
          if (!esquema.properties?.[k]) errores.push(`${ruta}.${k}: campo no permitido`);
      }
      break;
    }
    case "array": {
      if (tipo !== "array") return [`${ruta}: se esperaba una lista`];
      const arr = valor as unknown[];
      if (esquema.maxItems != null && arr.length > esquema.maxItems)
        errores.push(`${ruta}: más de ${esquema.maxItems} elementos`);
      if (esquema.items)
        arr.forEach((v, i) => {
          errores.push(...validar(v, esquema.items!, `${ruta}[${i}]`));
        });
      break;
    }
    case "string": {
      if (tipo !== "string") return [`${ruta}: se esperaba texto`];
      const s = valor as string;
      if (esquema.minLength != null && s.trim().length < esquema.minLength)
        errores.push(`${ruta}: texto demasiado corto`);
      if (esquema.maxLength != null && s.length > esquema.maxLength) errores.push(`${ruta}: texto demasiado largo`);
      break;
    }
    case "number":
    case "integer": {
      if (tipo !== "number" || Number.isNaN(valor)) return [`${ruta}: se esperaba un número`];
      const n = valor as number;
      if (esquema.type === "integer" && !Number.isInteger(n)) errores.push(`${ruta}: se esperaba un entero`);
      if (esquema.minimum != null && n < esquema.minimum) errores.push(`${ruta}: menor que ${esquema.minimum}`);
      if (esquema.maximum != null && n > esquema.maximum) errores.push(`${ruta}: mayor que ${esquema.maximum}`);
      break;
    }
    case "boolean":
      if (tipo !== "boolean") return [`${ruta}: se esperaba verdadero o falso`];
      break;
  }
  if (esquema.enum && !esquema.enum.includes(valor as string | number))
    errores.push(`${ruta}: valor fuera del catálogo`);
  return errores;
}

/** Versión para el proveedor: sin límites numéricos ni de longitud, que algunos modelos no aceptan en modo estricto. */
export function paraProveedor(esquema: Esquema): Esquema {
  const { minimum: _a, maximum: _b, minLength: _c, maxLength: _d, maxItems: _e, ...resto } = esquema;
  return {
    ...resto,
    ...(esquema.properties && {
      properties: Object.fromEntries(Object.entries(esquema.properties).map(([k, v]) => [k, paraProveedor(v)])),
    }),
    ...(esquema.items && { items: paraProveedor(esquema.items) }),
  };
}
