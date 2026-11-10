import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { ClaveRol } from '../datos/modelos';
import type { UsuarioSesion } from '../datos/repositorios/vistas';

export const ES_PUBLICO = 'esPublico';
export const ROLES = 'roles';

/** Ruta accesible sin sesión. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

/** Roles autorizados para la ruta (RBAC). */
export const Roles = (...roles: ClaveRol[]) => SetMetadata(ROLES, roles);

export interface PeticionAutenticada extends Request {
  usuario: UsuarioSesion;
  zonaHoraria: string;
}

/** Usuario de la sesión actual. */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<PeticionAutenticada>().usuario);

/** Datos de contexto para la bitácora: IP y zona horaria del usuario. */
export interface Contexto { usuario: UsuarioSesion; ip: string | null; zonaHoraria: string }

export const ContextoPeticion = createParamDecorator((_: unknown, ctx: ExecutionContext): Contexto => {
  const req = ctx.switchToHttp().getRequest<PeticionAutenticada>();
  return { usuario: req.usuario, ip: req.ip ?? null, zonaHoraria: req.zonaHoraria };
});
