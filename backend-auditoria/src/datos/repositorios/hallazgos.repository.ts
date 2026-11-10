import type { Hallazgo } from '../modelos';
import type { HallazgoVista } from './vistas';

export type NuevoHallazgo = Omit<Hallazgo, 'id' | 'tracking_id' | 'estado' | 'fecha_identificacion' | 'riesgo_residual' | 'responsable_id'>;

export abstract class HallazgosRepository {
  abstract listar(): Promise<HallazgoVista[]>;
  abstract porAuditoria(auditoriaId: number): Promise<HallazgoVista[]>;
  abstract crear(datos: NuevoHallazgo): Promise<Hallazgo>;
  abstract cambiarEstado(id: number, estado: Hallazgo['estado']): Promise<void>;
  abstract procedimientoPerteneceA(procedimientoId: number, auditoriaId: number): Promise<boolean>;
  abstract marcarProcedimientoConHallazgo(procedimientoId: number): Promise<void>;
}
