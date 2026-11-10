import { Injectable } from '@nestjs/common';
import { NuevaSesion, SesionesRepository } from '../repositorios/sesiones.repository';

@Injectable()
export class SesionesMemoriaRepository extends SesionesRepository {
  private readonly sesiones: (NuevaSesion & { revocada: boolean })[] = [];

  async crear(s: NuevaSesion) {
    this.sesiones.push({ ...s, revocada: false });
  }

  async usuarioDe(tokenHash: string, ahora: Date) {
    const s = this.sesiones.find((x) => x.tokenHash === tokenHash && !x.revocada && x.expira > ahora);
    return s?.usuarioId ?? null;
  }

  async revocar(tokenHash: string) {
    for (const s of this.sesiones) if (s.tokenHash === tokenHash) s.revocada = true;
  }
}
