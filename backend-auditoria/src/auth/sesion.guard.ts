import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ES_PUBLICO, PeticionAutenticada, ROLES } from "./decoradores";
import { prohibido } from "../common/errores";
import { BitacoraService } from "../bitacora/bitacora.service";
import type { ClaveRol } from "../datos/modelos";
import { IdentificadorSesion } from "./sesiones.service";

/**
 * HU_01 / FE1S-37. El usuario sale de la cookie de sesión (SesionesService), nunca de un encabezado que mande el navegador.
 * Al integrar Microsoft Entra ID sólo cambia cómo se abre la sesión; esta guarda sigue igual.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: IdentificadorSesion,
    private readonly bitacora: BitacoraService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivo = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, objetivo)) return true;

    const req = ctx.switchToHttp().getRequest<PeticionAutenticada>();
    const usuario = await this.sesiones.identificar(req);
    req.usuario = usuario;
    req.zonaHoraria = req.get("X-Zona-Horaria") || usuario.zona_horaria;

    const roles = this.reflector.getAllAndOverride<ClaveRol[] | undefined>(ROLES, objetivo);
    if (roles?.length && !roles.includes(usuario.rol)) {
      // hu_15: el intento de entrar a una ruta sin el rol se registra como acceso denegado
      await this.bitacora.registrarAcceso({
        usuario_id: usuario.id,
        correo: usuario.correo,
        resultado: "denegado",
        ip: req.ip ?? null,
        agente: req.get("user-agent") ?? null,
        zona_horaria: req.zonaHoraria,
      });
      throw prohibido();
    }
    return true;
  }
}
