import { Injectable } from "@nestjs/common";
import { BaseDeDatosMemoria } from "./base-de-datos-memoria";
import {
  DestinoEvidencia,
  EvidenciaConAuditoria,
  EvidenciaHija,
  EvidenciasRepository,
  NuevaEvidencia,
} from "../repositorios/evidencias.repository";

@Injectable()
export class EvidenciasMemoriaRepository extends EvidenciasRepository {
  constructor(private readonly db: BaseDeDatosMemoria) {
    super();
  }

  async destinoValido(d: DestinoEvidencia) {
    if (d.procedimientoId)
      return this.db.procedimientos.some((p) => p.id === d.procedimientoId && p.auditoria_id === d.auditoriaId);
    // Las PBC todavía no tienen adaptador en memoria; en SQL se valida su relación con el procedimiento y la auditoría.
    return false;
  }

  async crear(d: NuevaEvidencia, hijas: EvidenciaHija[], reemplazaId?: number) {
    const p = this.db.procedimientos.find((x) => x.id === d.procedimiento_id)!;
    const folio = this.db.siguienteFolio("soporte");
    const padre = {
      ...d,
      id: this.db.siguienteId("evidencias"),
      tracking_id: folio,
      evidencia_padre_id: null,
      fecha_carga: new Date(),
      eliminado: false,
    };
    this.db.evidencias.push(padre);
    hijas.forEach((h, i) => {
      this.db.evidencias.push({
        ...h,
        id: this.db.siguienteId("evidencias"),
        tracking_id: `${folio}-${String(i + 1).padStart(3, "0")}`,
        evidencia_padre_id: padre.id,
        procedimiento_id: null,
        solicitud_pbc_id: null,
        hallazgo_id: null,
        blob_url: null,
        cargado_por_id: d.cargado_por_id,
        fecha_carga: padre.fecha_carga,
        eliminado: false,
      });
    });
    if (reemplazaId) {
      const anterior = this.db.evidencias.find((e) => e.id === reemplazaId);
      if (anterior) anterior.eliminado = true;
    }
    return structuredClone({ ...padre, auditoria_id: p.auditoria_id }) as EvidenciaConAuditoria;
  }

  async buscar(id: number) {
    const original = this.db.evidencias.find((e) => e.id === id);
    if (!original) return null;
    const padre = original.evidencia_padre_id
      ? this.db.evidencias.find((e) => e.id === original.evidencia_padre_id)
      : original;
    const p = padre?.procedimiento_id ? this.db.procedimientos.find((x) => x.id === padre.procedimiento_id) : null;
    if (!p) return null;
    return structuredClone({
      ...original,
      blob_url: original.blob_url ?? padre?.blob_url ?? null,
      auditoria_id: p.auditoria_id,
      cargado_por: this.db.usuarios.find((u) => u.id === original.cargado_por_id)?.nombre ?? "",
    }) as EvidenciaConAuditoria;
  }

  async marcarEliminada(id: number) {
    for (const e of this.db.evidencias) if (e.id === id || e.evidencia_padre_id === id) e.eliminado = true;
  }
}
