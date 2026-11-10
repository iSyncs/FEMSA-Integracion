import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const RELLENO = new Set(['na', 'n/a', 'n.a.', 'ninguno', 'ninguna', 'nada', 'x', 'xx', 'xxx', 'xxxx', 'asdf', 'test', 'prueba', '-', '--', '...', '.', 'sin comentarios', 'pendiente']);

/** Devuelve el mensaje de error o null. Regla de la retroalimentación del SRS: no basta con "no vacío". */
export function validarTexto(valor: unknown, min: number, campo: string): string | null {
  const t = String(valor ?? '').trim();
  if (!t) return `Completa ${campo}.`;
  if (RELLENO.has(t.toLowerCase())) return `Describe ${campo} con información real, no con texto de relleno.`;
  const alfanumericos = (t.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (t.length < min || alfanumericos < Math.ceil(min * 0.6)) {
    return `${campo.charAt(0).toUpperCase()}${campo.slice(1)} debe tener al menos ${min} caracteres con contenido (actualmente ${t.length}).`;
  }
  return null;
}

/** Decorador de class-validator: texto obligatorio con contenido real. */
export function TextoSignificativo(min: number, campo: string, opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) => registerDecorator({
    name: 'textoSignificativo',
    target: objeto.constructor,
    propertyName: propiedad,
    options: opciones,
    validator: {
      validate: (valor: unknown) => validarTexto(valor, min, campo) === null,
      defaultMessage: (args: ValidationArguments) => validarTexto(args.value, min, campo) ?? '',
    },
  });
}
