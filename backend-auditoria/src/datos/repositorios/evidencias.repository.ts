import type { Evidencia } from "../modelos";

export interface DestinoEvidencia {
  auditoriaId: number;
  procedimientoId: number | null;
  solicitudPbcId: number | null;
}

export interface EvidenciaConAuditoria extends Evidencia {
  auditoria_id: number;
  cargado_por?: string;
}

export type NuevaEvidencia = Omit<Evidencia, "id" | "tracking_id" | "fecha_carga" | "eliminado" | "evidencia_padre_id">;
export type EvidenciaHija = Pick<Evidencia, "nombre_archivo" | "tipo_mime" | "tamano_bytes" | "hash_sha256">;

export abstract class EvidenciasRepository {
  abstract destinoValido(destino: DestinoEvidencia): Promise<boolean>;
  abstract crear(datos: NuevaEvidencia, hijas: EvidenciaHija[], reemplazaId?: number): Promise<EvidenciaConAuditoria>;
  abstract buscar(id: number): Promise<EvidenciaConAuditoria | null>;
  abstract marcarEliminada(id: number): Promise<void>;
}
