import { compare, hashSync } from "bcryptjs";

const COSTO = 10;

export function hashContrasena(contrasena: string): string {
  return hashSync(contrasena, COSTO);
}

export async function verificarContrasena(contrasena: string, guardado: string | null): Promise<boolean> {
  if (!guardado?.startsWith("$2")) return false;
  return compare(contrasena, guardado);
}
