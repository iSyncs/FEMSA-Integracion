import { UnprocessableEntityException, ValidationError, ValidationPipe } from '@nestjs/common';

/** Errores de validación como { error, detalles: { campo: mensaje } } (formato que consume el frontend). */
export const pipeDeValidacion = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errores: ValidationError[]) => new UnprocessableEntityException({
    error: 'Revisa los campos marcados.',
    detalles: Object.fromEntries(errores.map((e) => [e.property, Object.values(e.constraints ?? {})[0] ?? 'Valor inválido.'])),
  }),
});
