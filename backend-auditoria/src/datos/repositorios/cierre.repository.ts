import type { Aprobacion, Cierre, NivelAprobacion } from '../modelos';
import type { AprobacionVista } from './vistas';

export abstract class CierreRepository {
  abstract aprobaciones(auditoriaId: number): Promise<AprobacionVista[]>;
  abstract iniciarRonda(auditoriaId: number, niveles: NivelAprobacion[]): Promise<void>;
  abstract registrarDecision(aprobacionId: number, cambios: Pick<Aprobacion, 'decision' | 'aprobador_id' | 'comentarios' | 'zona_horaria'>): Promise<void>;
  abstract cierre(auditoriaId: number): Promise<Cierre | null>;
  abstract guardarCierre(cierre: Omit<Cierre, 'id'>): Promise<void>;
  abstract notificar(usuarioId: number, auditoriaId: number, tipo: string, mensaje: string): Promise<void>;
}
