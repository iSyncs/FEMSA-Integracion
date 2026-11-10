/**
 * Lotes de evidencia: lo que el área auditada envía de una sola vez en respuesta a una solicitud PBC
 * (en producción llegaría por correo; en el Release 1 lo sube el auditado desde la app).
 * La IA analiza cada documento del lote en cuanto llega.
 */
export type EstadoLote = 'pendiente' | 'analizando' | 'listo' | 'error';

export interface DocumentoLote {
  id: number; tracking_id: string; nombre_archivo: string; tipo_mime: string | null;
}

export interface Lote {
  id: number; tracking_id: string; auditoria_id: number; auditoria_folio: string; auditoria: string;
  solicitud_pbc_id: number | null; enviado_por_id: number; enviado_por: string; asunto: string;
  estado: EstadoLote; total: number; analizados: number; error: string | null;
  recibido: Date; inicio: Date | null; fin: Date | null; documentos: DocumentoLote[];
}

export interface NuevoLote {
  auditoriaId: number; solicitudPbcId: number | null; enviadoPor: number; asunto: string; evidencias: number[];
}

export abstract class LotesRepository {
  abstract crear(datos: NuevoLote): Promise<Lote>;
  abstract listar(): Promise<Lote[]>;
  abstract buscar(id: number): Promise<Lote | null>;
  abstract actualizar(id: number, cambios: Partial<Pick<Lote, 'estado' | 'analizados' | 'error' | 'inicio' | 'fin'>>): Promise<void>;
  /** Evidencias que ya forman parte de algún lote (no se pueden reenviar). */
  abstract enLote(evidencias: number[]): Promise<number[]>;
}
