import { Injectable } from "@nestjs/common";
import { BaseDeDatosMemoria } from "./base-de-datos-memoria";
import { Lote, LotesRepository, NuevoLote } from "../repositorios/lotes.repository";

type FilaLote = Omit<Lote, "auditoria_folio" | "auditoria" | "enviado_por" | "documentos"> & { evidencias: number[] };

@Injectable()
export class LotesMemoriaRepository extends LotesRepository {
  private readonly lotes: FilaLote[] = [];

  constructor(private readonly db: BaseDeDatosMemoria) {
    super();
  }

  private vista(f: FilaLote): Lote {
    const a = this.db.auditorias.find((x) => x.id === f.auditoria_id);
    const u = this.db.usuarios.find((x) => x.id === f.enviado_por_id);
    const { evidencias, ...resto } = structuredClone(f);
    return {
      ...resto,
      auditoria_folio: a?.tracking_id ?? "",
      auditoria: a?.nombre ?? "",
      enviado_por: u?.nombre ?? "",
      documentos: evidencias
        .map((id) => this.db.evidencias.find((e) => e.id === id))
        .filter((e) => !!e)
        .map((e) => ({
          id: e.id,
          tracking_id: e.tracking_id,
          nombre_archivo: e.nombre_archivo,
          tipo_mime: e.tipo_mime,
        })),
    };
  }

  async crear(d: NuevoLote) {
    const id = Math.max(0, ...this.lotes.map((x) => x.id)) + 1;
    const fila: FilaLote = {
      id,
      tracking_id: `LOT-${String(id).padStart(6, "0")}`,
      auditoria_id: d.auditoriaId,
      solicitud_pbc_id: d.solicitudPbcId,
      enviado_por_id: d.enviadoPor,
      asunto: d.asunto,
      estado: "pendiente",
      total: d.evidencias.length,
      analizados: 0,
      error: null,
      recibido: new Date(),
      inicio: null,
      fin: null,
      evidencias: [...d.evidencias],
    };
    this.lotes.push(fila);
    return this.vista(fila);
  }

  async listar() {
    return [...this.lotes].sort((a, b) => b.id - a.id).map((f) => this.vista(f));
  }

  async buscar(id: number) {
    const f = this.lotes.find((x) => x.id === id);
    return f ? this.vista(f) : null;
  }

  async actualizar(id: number, cambios: Partial<Pick<Lote, "estado" | "analizados" | "error" | "inicio" | "fin">>) {
    const f = this.lotes.find((x) => x.id === id);
    if (f) Object.assign(f, cambios);
  }

  async enLote(evidencias: number[]) {
    const usadas = new Set(this.lotes.flatMap((l) => l.evidencias));
    return evidencias.filter((e) => usadas.has(e));
  }
}
