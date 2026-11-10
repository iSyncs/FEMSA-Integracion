import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { IdentificadorSesion } from "../src/auth/sesiones.service";
import { UsuariosRepository } from "../src/datos/repositorios/usuarios.repository";

/**
 * Solo para pruebas e2e: toma el usuario del encabezado X-Usuario-Id para no iniciar sesión en cada caso.
 * La API real no acepta ese encabezado (ver test/sesion.e2e-spec.ts).
 */
@Injectable()
export class IdentificadorDePrueba extends IdentificadorSesion {
  constructor(private readonly usuarios: UsuariosRepository) {
    super();
  }

  async identificar(req: Request) {
    const id = Number(req.get("X-Usuario-Id"));
    const usuario = Number.isInteger(id) && id > 0 ? await this.usuarios.buscarActivo(id) : null;
    if (!usuario) throw new UnauthorizedException("Sesión no iniciada.");
    return usuario;
  }
}
