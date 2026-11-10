import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export const noEncontrado = (que = 'Registro') => new NotFoundException(`${que} no encontrado.`);
export const prohibido = (mensaje = 'Tu rol no tiene permiso para esta acción.') => new ForbiddenException(mensaje);
export const conflicto = (mensaje: string, detalles?: unknown) => new ConflictException({ message: mensaje, detalles });
