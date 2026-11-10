import type { Auditoria, EstadoAuditoria, EstadoProcedimiento, EvaluacionProcedimiento, Procedimiento } from '../modelos';
import type { Contexto } from '../../auth/decoradores';
import type { AuditoriaVista, EvidenciaVista, ProcedimientoVista } from './vistas';

export type NuevaAuditoria = Omit<Auditoria, 'id' | 'tracking_id' | 'creado_en' | 'estado'>;

export abstract class AuditoriasRepository {
  abstract listar(): Promise<AuditoriaVista[]>;
  abstract buscar(id: number): Promise<AuditoriaVista | null>;
  abstract crear(datos: NuevaAuditoria): Promise<Auditoria>;
  abstract cambiarEstado(id: number, estado: EstadoAuditoria): Promise<void>;
  abstract auditoriasDeParticipante(usuarioId: number): Promise<number[]>;
  abstract procedimientos(auditoriaId: number): Promise<ProcedimientoVista[]>;
  abstract procedimiento(id: number): Promise<ProcedimientoVista | null>;
  abstract evaluarProcedimiento(id: number, evaluacion: EvaluacionProcedimiento, ctx: Contexto): Promise<Procedimiento>;
  abstract procedimientosPorEstado(auditoriaIds: number[]): Promise<Record<EstadoProcedimiento, number>>;
  abstract evidencias(auditoriaId: number): Promise<EvidenciaVista[]>;
}
