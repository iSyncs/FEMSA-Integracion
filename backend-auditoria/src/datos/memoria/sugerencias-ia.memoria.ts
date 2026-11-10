import { Injectable } from '@nestjs/common';
import { AnalisisGuardado, SugerenciasIaRepository } from '../repositorios/sugerencias-ia.repository';

@Injectable()
export class SugerenciasIaMemoriaRepository extends SugerenciasIaRepository {
  private readonly filas: AnalisisGuardado[] = [];

  async listar<P>() {
    return structuredClone(this.filas) as AnalisisGuardado<P>[];
  }

  async buscar<P>(auditoriaId: number, evidenciaId: number) {
    const f = this.filas.find((x) => x.auditoriaId === auditoriaId && x.evidenciaId === evidenciaId);
    return f ? (structuredClone(f) as AnalisisGuardado<P>) : null;
  }

  async buscarPorId<P>(id: number) {
    const f = this.filas.find((x) => x.id === id);
    return f ? (structuredClone(f) as AnalisisGuardado<P>) : null;
  }

  async guardar<P>({ usuarioId: _usuario, ...d }: Omit<AnalisisGuardado<P>, 'id'> & { usuarioId: number }) {
    const fila = { ...structuredClone(d), id: Math.max(0, ...this.filas.map((x) => x.id)) + 1 };
    this.filas.push(fila);
    return structuredClone(fila) as AnalisisGuardado<P>;
  }

  async actualizar<P>(id: number, contenido: P) {
    const f = this.filas.find((x) => x.id === id);
    if (f) f.contenido = structuredClone(contenido);
  }
}
