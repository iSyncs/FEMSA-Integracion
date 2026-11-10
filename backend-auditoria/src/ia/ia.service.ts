import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { IaCliente } from "./ia.cliente";
import { IdSkill, SKILLS } from "./skills";

const LIMITE_POR_MINUTO = 20;

/** FE1S-24 · Punto único de entrada a la IA: aplica el límite por usuario y ejecuta la skill. */
@Injectable()
export class IaService {
  private readonly usos = new Map<number, number[]>();

  constructor(private readonly cliente: IaCliente) {}

  estado() {
    return this.cliente.descripcion();
  }

  async ejecutar(usuario: UsuarioSesion, id: IdSkill, entrada: unknown) {
    this.controlarLimite(usuario.id);
    const skill = SKILLS[id] as Parameters<IaCliente["ejecutar"]>[0];
    const r = await this.cliente.ejecutar(skill, entrada);
    // La IA solo sugiere: nada se guarda hasta que el usuario acepta con los endpoints de hallazgos o planes.
    return { skill: id, sugerencia: r.resultado, modelo: r.modelo, ms: r.ms };
  }

  private controlarLimite(usuarioId: number, ahora = Date.now()) {
    const recientes = (this.usos.get(usuarioId) ?? []).filter((t) => ahora - t < 60_000);
    if (recientes.length >= LIMITE_POR_MINUTO) {
      throw new HttpException("Demasiadas solicitudes a la IA. Espera un minuto.", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.usos.set(usuarioId, [...recientes, ahora]);
  }
}
