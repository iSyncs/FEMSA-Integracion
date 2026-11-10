import type { Avance, Plan } from '../modelos';
import type { UsuarioSesion } from './vistas';
import type { PlanVista } from './vistas';

export abstract class PlanesRepository {
  abstract listar(): Promise<PlanVista[]>;
  abstract buscar(id: number): Promise<PlanVista | null>;
  abstract crear(datos: Omit<Plan, 'id' | 'tracking_id'>): Promise<Plan>;
  abstract actualizar(id: number, cambios: Partial<Pick<Plan, 'estado' | 'avance_pct' | 'fecha_conclusion'>>): Promise<void>;
  abstract registrarAvance(avance: Omit<Avance, 'id' | 'fecha'>): Promise<Avance>;
  abstract avances(planId: number): Promise<(Avance & { usuario: string })[]>;
  abstract validar(id: number, estadoEsperado: Plan['estado'], decision: 'aprobado' | 'rechazado', comentario: string | null, usuario: UsuarioSesion, zonaHoraria: string, ip: string | null): Promise<void>;
  abstract hallazgosSinPlan(auditoriaId: number): Promise<{ id: number; tracking_id: string; titulo: string }[]>;
}