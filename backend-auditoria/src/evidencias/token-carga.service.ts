import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface CargaPendiente {
  usuarioId: number;
  auditoriaId: number;
  procedimientoId: number | null;
  solicitudPbcId: number | null;
  reemplazaId: number | null;
  nombre: string;
  mime: string;
  tamano: number;
  blob: string;
  exp: number;
}

@Injectable()
export class TokenCargaService {
  private readonly secreto = Buffer.from(process.env.EVIDENCE_TOKEN_SECRET ?? randomBytes(32).toString("hex"));
  firmar(datos: Omit<CargaPendiente, "exp">) {
    const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Date.now() + 15 * 60_000 })).toString("base64url");
    return `${cuerpo}.${createHmac("sha256", this.secreto).update(cuerpo).digest("base64url")}`;
  }
  verificar(token: string): CargaPendiente {
    const [cuerpo, firma, extra] = token.split(".");
    if (!cuerpo || !firma || extra) throw new UnauthorizedException("Token de carga inválido.");
    const esperada = createHmac("sha256", this.secreto).update(cuerpo).digest();
    const recibida = Buffer.from(firma, "base64url");
    const firmaCanonica = recibida.toString("base64url");
    if (firma !== firmaCanonica || recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
      throw new UnauthorizedException("Token de carga inválido.");
    }
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as CargaPendiente;
    if (!Number.isFinite(datos.exp) || datos.exp < Date.now())
      throw new UnauthorizedException("El token de carga expiró.");
    return datos;
  }
}
