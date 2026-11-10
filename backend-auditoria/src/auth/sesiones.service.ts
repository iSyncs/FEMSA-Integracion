import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request } from "express";
import { SesionesRepository } from "../datos/repositorios/sesiones.repository";
import { UsuariosRepository } from "../datos/repositorios/usuarios.repository";
import type { UsuarioSesion } from "../datos/repositorios/vistas";

export const COOKIE_SESION = "femsa_sesion";
const DURACION_MS = 8 * 60 * 60 * 1000;
const INTENTOS_MAXIMOS = 10;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

const huella = (token: string) => createHash("sha256").update(token).digest("hex");

/** Lee una cookie del encabezado sin depender de cookie-parser. */
export function leerCookie(req: Request, nombre: string): string | null {
  for (const parte of (req.get("cookie") ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** HttpOnly: el JavaScript de la página no la lee. SameSite=Lax: no viaja en peticiones POST de otros sitios. */
export function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: DURACION_MS,
  };
}

/**
 * Quién hace la petición. La implementación real lee la cookie de sesión; las pruebas e2e la reemplazan
 * por una que lee un encabezado (test/identificador-de-prueba.ts) para no iniciar sesión en cada caso.
 */
export abstract class IdentificadorSesion {
  abstract identificar(req: Request): Promise<UsuarioSesion>;
}

@Injectable()
export class SesionesService extends IdentificadorSesion {
  // Intentos fallidos por IP y correo. Vive en memoria de cada instancia: frena ataques simples, no distribuidos.
  private readonly fallidos = new Map<string, number[]>();

  constructor(
    private readonly repo: SesionesRepository,
    private readonly usuarios: UsuariosRepository,
  ) {
    super();
  }

  async abrir(usuarioId: number, req: Request) {
    const token = randomBytes(32).toString("base64url");
    await this.repo.crear({
      usuarioId,
      tokenHash: huella(token),
      expira: new Date(Date.now() + DURACION_MS),
      ip: req.ip ?? null,
      agente: req.get("user-agent") ?? null,
    });
    return token;
  }

  async cerrar(req: Request) {
    const token = leerCookie(req, COOKIE_SESION);
    if (token) await this.repo.revocar(huella(token));
  }

  async identificar(req: Request): Promise<UsuarioSesion> {
    const token = leerCookie(req, COOKIE_SESION);
    if (!token) throw new UnauthorizedException("Sesión no iniciada.");
    const id = await this.repo.usuarioDe(huella(token), new Date());
    const usuario = id ? await this.usuarios.buscarActivo(id) : null;
    if (!usuario) throw new UnauthorizedException("La sesión expiró o el usuario ya no está activo.");
    return usuario;
  }

  /** Antes de revisar la contraseña: 429 si hubo demasiados intentos fallidos recientes. */
  revisarIntentos(clave: string, ahora = Date.now()) {
    const recientes = (this.fallidos.get(clave) ?? []).filter((t) => ahora - t < VENTANA_INTENTOS_MS);
    this.fallidos.set(clave, recientes);
    if (recientes.length >= INTENTOS_MAXIMOS) {
      throw new HttpException(
        "Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registrarIntento(clave: string, exito: boolean, ahora = Date.now()) {
    if (exito) this.fallidos.delete(clave);
    else this.fallidos.set(clave, [...(this.fallidos.get(clave) ?? []), ahora]);
  }
}
