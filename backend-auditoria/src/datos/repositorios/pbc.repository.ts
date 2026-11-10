import type { EstadoPbc, EstadoPuntoPbc, PuntoPbc, SolicitudPbcRegistro } from "../modelos";

/**
 * HU_05 · Solicitudes de información (PBC). El auditor pide documentos al área auditada; el área responde
 * con un lote de evidencia y el auditor revisa punto por punto.
 */
export interface SolicitudPbc extends SolicitudPbcRegistro {
  auditoria_id: number;
  auditoria_folio: string;
  auditoria: string;
  procedimiento: string;
  control: string;
  solicitado_por: string | null;
  solicitado_a: string | null;
  puntos: PuntoPbc[];
}

export interface NuevaSolicitudPbc {
  procedimientoId: number;
  solicitadoPorId: number | null;
  solicitadoAId: number | null;
  asunto: string | null;
  fechaLimite: Date | null;
  puntos: { descripcion: string; obligatorio: boolean }[];
}

export interface CambiosSolicitudPbc {
  estado?: EstadoPbc;
  enviado?: Date | null;
  cerrado?: Date | null;
  comentario_revision?: string | null;
}

export abstract class PbcRepository {
  /** Las más recientes primero; con auditoriaId, solo las de esa auditoría. */
  abstract listar(auditoriaId?: number): Promise<SolicitudPbc[]>;
  abstract buscar(id: number): Promise<SolicitudPbc | null>;
  abstract crear(datos: NuevaSolicitudPbc): Promise<number>;
  abstract actualizar(id: number, cambios: CambiosSolicitudPbc): Promise<void>;
  abstract marcarPuntos(solicitudId: number, puntos: { id: number; estado: EstadoPuntoPbc }[]): Promise<void>;
}
