import { Injectable } from '@nestjs/common';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { PlanesRepository } from '../datos/repositorios/planes.repository';

export interface Pendiente { tipo: 'procedimiento' | 'hallazgo'; folio: string; descripcion: string }

/** HU_06 · Validación automática de pre-cierre. */
@Injectable()
export class PrecierreService {
  constructor(private readonly auditorias: AuditoriasRepository, private readonly planes: PlanesRepository) {}

  async evaluar(auditoriaId: number): Promise<{ listo: boolean; pendientes: Pendiente[] }> {
    const [procedimientos, sinPlan] = await Promise.all([
      this.auditorias.procedimientos(auditoriaId),
      this.planes.hallazgosSinPlan(auditoriaId),
    ]);
    const pendientes: Pendiente[] = [
      ...(procedimientos.length === 0 ? [{ tipo: 'procedimiento' as const, folio: '—', descripcion: 'La auditoría no tiene procedimientos asignados.' }] : []),
      ...procedimientos.filter((p) => p.estado !== 'supervisado').map((p) => ({
        tipo: 'procedimiento' as const, folio: p.tracking_id, descripcion: `${p.control}: estado "${p.estado}", debe estar supervisado por la Jefatura.`,
      })),
      ...sinPlan.map((h) => ({ tipo: 'hallazgo' as const, folio: h.tracking_id, descripcion: `${h.titulo}: no tiene plan de remediación propuesto.` })),
    ];
    return { listo: pendientes.length === 0, pendientes };
  }
}
