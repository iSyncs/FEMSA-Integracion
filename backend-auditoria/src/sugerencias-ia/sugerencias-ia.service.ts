import { ConflictException, Injectable } from "@nestjs/common";
import { AccesoService } from "../auth/acceso.service";
import type { Contexto } from "../auth/decoradores";
import { BitacoraService } from "../bitacora/bitacora.service";
import { noEncontrado } from "../common/errores";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { AnalisisGuardado, SugerenciasIaRepository } from "../datos/repositorios/sugerencias-ia.repository";
import { HallazgosService } from "../hallazgos/hallazgos.service";
import type { AnalizarEvidenciaDto } from "./sugerencias-ia.dto";
import { OpenRouterService, plantillaRevision } from "./openrouter.service";
import { ContenidoEvidenciaService } from "./contenido-evidencia.service";

type EstadoSugerencia = "pendiente" | "aceptada" | "descartada";

interface Sugerencia {
  id: number;
  auditoriaId: number;
  procedimientoId: number | null;
  auditoria: string;
  lote: string;
  prioridad: number;
  titulo: string;
  condicion: string;
  criterio: string;
  causa: string;
  efecto: string;
  recomendacion: string;
  severidad: "Crítica" | "Alta" | "Moderada" | "Baja";
  tipo: "Debilidad de control" | "Debilidad menor";
  impactoMxn?: number;
  evidencia: string;
  confianza: number;
  estado: EstadoSugerencia;
  motivoDescarte?: string;
}

interface DocumentoClasificado {
  id: number;
  auditoriaId: number;
  nombre: string;
  tipo: string;
  confianza: number;
  estado: string;
  resumen: string;
  puntosClave: string[];
  verificaciones: { aspecto: string; estado: "Presente" | "Faltante"; detalle: string }[];
}
interface EvidenciaFaltante {
  id: number;
  auditoriaId: number;
  auditoria: string;
  documentoId: number;
  documento: string;
  texto: string;
  referencia: string;
  criticidad: "Alta" | "Moderada" | "Baja";
}

/** Lo que se guarda por evidencia analizada (dbo.IA_ANALYSIS.payload). Los id se derivan del id del análisis. */
interface ContenidoAnalisis {
  documentos: Omit<DocumentoClasificado, "id" | "auditoriaId">[];
  faltantes: Omit<EvidenciaFaltante, "id" | "auditoriaId" | "documentoId">[];
  sugerencias: Omit<Sugerencia, "id" | "auditoriaId" | "lote">[];
}
type Resumen = { lote: string; documentoId: number | null; documentos: number; faltantes: number; borradores: number };

// Cada análisis reserva 1,000 id por lista: id = análisis × 1000 + posición (1, 2, …).
const BLOQUE = 1000;
const idDe = (analisisId: number, i: number) => analisisId * BLOQUE + i + 1;

export const porcentajeConfianza = (valor: number) => {
  const numero = Number.isFinite(valor) ? valor : 0;
  return Math.round(Math.min(100, Math.max(0, numero >= 0 && numero <= 1 ? numero * 100 : numero)));
};

@Injectable()
export class SugerenciasIaService {
  private readonly procesando = new Set<number>();
  // Dos clics seguidos sobre la misma evidencia comparten una sola llamada a la IA.
  private readonly enCurso = new Map<string, Promise<Resumen & { enCache: boolean }>>();

  constructor(
    private readonly acceso: AccesoService,
    private readonly hallazgos: HallazgosService,
    private readonly bitacora: BitacoraService,
    private readonly openRouter: OpenRouterService,
    private readonly contenidoEvidencia: ContenidoEvidenciaService,
    private readonly repo: SugerenciasIaRepository,
  ) {}

  private resumenDe(a: AnalisisGuardado<ContenidoAnalisis>): Resumen {
    return {
      lote: a.lote,
      documentoId: a.contenido.documentos.length ? idDe(a.id, 0) : null,
      documentos: a.contenido.documentos.length,
      faltantes: a.contenido.faltantes.length,
      borradores: a.contenido.sugerencias.length,
    };
  }

  private async visibles(usuario: UsuarioSesion, analisis: AnalisisGuardado<ContenidoAnalisis>[]) {
    const ids = new Set<number>();
    for (const id of new Set(analisis.map((a) => a.auditoriaId))) {
      try {
        await this.acceso.auditoriaVisible(usuario, id);
        ids.add(id);
      } catch {
        /* Seguridad por fila: no revelar la auditoría. */
      }
    }
    return ids;
  }

  async analizar(ctx: Contexto, dto: AnalizarEvidenciaDto, lote?: string) {
    const auditoria = await this.acceso.auditoriaAbierta(
      ctx.usuario,
      dto.auditoriaId,
      "La auditoría ya no admite nuevos análisis ni hallazgos.",
    );
    // Ahorro de tokens: cada evidencia se analiza una sola vez; repetir el análisis regresa el resultado guardado.
    const previo = await this.repo.buscar<ContenidoAnalisis>(dto.auditoriaId, dto.evidenciaId);
    if (previo) return { ...this.resumenDe(previo), enCache: true };
    const clave = `${dto.auditoriaId}:${dto.evidenciaId}`;
    const pendiente = this.enCurso.get(clave);
    if (pendiente) return pendiente;
    const tarea = this.analizarNueva(ctx, dto, auditoria, lote).finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, tarea);
    return tarea;
  }

  private async analizarNueva(
    ctx: Contexto,
    dto: AnalizarEvidenciaDto,
    auditoria: Awaited<ReturnType<AccesoService["auditoriaVisible"]>>,
    folioLote?: string,
  ) {
    const documento = await this.contenidoEvidencia.extraer(ctx.usuario, dto.auditoriaId, dto.evidenciaId);
    const resultado = await this.openRouter.analizar({ documentos: [documento], usuarioId: ctx.usuario.id });
    const ausenciaExplicita =
      /\b(pendiente|faltante|ausente|incomplet[oa]s?|sin (firma|folio|versi[oó]n|anexo|soporte|fecha|nombre|cargo|responsable|aprobaci[oó]n|sello|causa|acci[oó]n)|no se (indic[oó]|document[oó]|incluy[oó]|adjunt[oó]))\b/i;
    resultado.verificaciones = resultado.verificaciones.map((v) => ({
      ...v,
      estado: v.estado === "Presente" && ausenciaExplicita.test(v.detalle) ? "Faltante" : v.estado,
    }));
    for (const v of resultado.verificaciones.filter((x) => x.estado === "Faltante")) {
      const yaExiste = resultado.faltantes.some((f) =>
        `${f.referencia} ${f.texto}`.toLocaleLowerCase("es").includes(v.aspecto.toLocaleLowerCase("es")),
      );
      if (!yaExiste) resultado.faltantes.push({ texto: v.detalle, referencia: v.aspecto, criticidad: "Moderada" });
    }
    const contenido: ContenidoAnalisis = {
      documentos: resultado.documentos.map((d) => ({
        nombre: d.nombre.slice(0, 255),
        tipo: d.tipo.slice(0, 120),
        confianza: porcentajeConfianza(d.confianza),
        estado: "Clasificado",
        resumen: resultado.resumen.slice(0, 3000),
        puntosClave: resultado.puntosClave.map((p) => p.slice(0, 500)),
        verificaciones: resultado.verificaciones.map((v) => ({
          aspecto: v.aspecto.slice(0, 150),
          estado: v.estado,
          detalle: v.detalle.slice(0, 500),
        })),
      })),
      faltantes: resultado.faltantes.map((f) => ({
        auditoria: auditoria.tracking_id,
        documento: documento.nombre.slice(0, 255),
        texto: f.texto.slice(0, 500),
        referencia: f.referencia.slice(0, 255),
        criticidad: f.criticidad,
      })),
      sugerencias: resultado.borradores.map((b, i) => ({
        procedimientoId: null,
        auditoria: auditoria.tracking_id,
        prioridad: i + 1,
        titulo: b.titulo.slice(0, 255),
        condicion: b.condicion.slice(0, 4000),
        criterio: b.criterio.slice(0, 4000),
        causa: b.causa.slice(0, 4000),
        efecto: b.efecto.slice(0, 4000),
        recomendacion: b.recomendacion.slice(0, 4000),
        severidad: b.severidad,
        tipo: b.tipo,
        impactoMxn: b.impactoMxn ?? undefined,
        evidencia: b.evidencia.slice(0, 1000),
        confianza: porcentajeConfianza(b.confianza),
        estado: "pendiente" as EstadoSugerencia,
      })),
    };
    const lote = folioLote ?? `IA-${Date.now()}`;
    const guardado = await this.repo.guardar<ContenidoAnalisis>({
      auditoriaId: auditoria.id,
      evidenciaId: dto.evidenciaId,
      lote,
      contenido,
      usuarioId: ctx.usuario.id,
    });
    await this.bitacora.registrarOperacion(ctx, {
      entidad: "sugerencias_ia",
      entidadId: auditoria.id,
      folio: lote,
      accion: "CREAR",
      nuevo: {
        documentos: contenido.documentos.length,
        faltantes: contenido.faltantes.length,
        borradores: contenido.sugerencias.length,
      },
    });
    return { ...this.resumenDe(guardado), enCache: false };
  }

  private vista(analisis: AnalisisGuardado<ContenidoAnalisis>[]) {
    const documentos: DocumentoClasificado[] = analisis.flatMap((a) =>
      a.contenido.documentos.map((d, i) => ({ ...d, id: idDe(a.id, i), auditoriaId: a.auditoriaId })),
    );
    const faltantes: EvidenciaFaltante[] = analisis.flatMap((a) =>
      a.contenido.faltantes.map((f, i) => ({
        ...f,
        id: idDe(a.id, i),
        auditoriaId: a.auditoriaId,
        documentoId: idDe(a.id, 0),
      })),
    );
    const sugerencias: Sugerencia[] = analisis
      .flatMap((a) =>
        a.contenido.sugerencias.map((s, i) => ({ ...s, id: idDe(a.id, i), auditoriaId: a.auditoriaId, lote: a.lote })),
      )
      .sort((a, b) => a.prioridad - b.prioridad);
    return { documentos, faltantes, sugerencias };
  }

  async listar(usuario: UsuarioSesion) {
    const analisis = await this.repo.listar<ContenidoAnalisis>();
    const ids = await this.visibles(usuario, analisis);
    const { documentos, faltantes, sugerencias } = this.vista(analisis.filter((a) => ids.has(a.auditoriaId)));
    const borradores = sugerencias.filter((s) => s.estado === "pendiente");
    return {
      documentos,
      faltantes,
      borradores,
      criterios: plantillaRevision,
      resumen: { documentos: documentos.length, faltantes: faltantes.length, pendientes: borradores.length },
    };
  }

  /** Resultado de la IA por evidencia (para el detalle de un lote); la visibilidad la valida quien llama. */
  async deEvidencias(auditoriaId: number, evidencias: number[]) {
    const analisis = (await this.repo.listar<ContenidoAnalisis>()).filter(
      (a) => a.auditoriaId === auditoriaId && evidencias.includes(a.evidenciaId),
    );
    return evidencias.map((evidenciaId) => {
      const propio = analisis.filter((a) => a.evidenciaId === evidenciaId);
      return { evidenciaId, analizado: propio.length > 0, ...this.vista(propio) };
    });
  }

  /** Ubica la sugerencia por su id (análisis × 1000 + posición) y valida que siga pendiente. */
  private async pendienteVisible(usuario: UsuarioSesion, id: number) {
    const analisis = await this.repo.buscarPorId<ContenidoAnalisis>(Math.floor(id / BLOQUE));
    const s = analisis?.contenido.sugerencias[(id % BLOQUE) - 1];
    if (!analisis || !s) throw noEncontrado("Sugerencia");
    await this.acceso.auditoriaVisible(usuario, analisis.auditoriaId);
    if (s.estado !== "pendiente" || this.procesando.has(id))
      throw new ConflictException("La sugerencia ya fue atendida. Actualiza la pantalla.");
    return { analisis, s };
  }

  async aceptar(ctx: Contexto, id: number) {
    const { analisis, s } = await this.pendienteVisible(ctx.usuario, id);
    this.procesando.add(id);
    try {
      const h = await this.hallazgos.crear(ctx, {
        auditoriaId: analisis.auditoriaId,
        procedimientoId: s.procedimientoId ?? undefined,
        titulo: s.titulo,
        condicion: s.condicion,
        criterio: s.criterio,
        causa: s.causa,
        efecto: s.efecto,
        recomendacion: s.recomendacion,
        severidad: s.severidad,
        tipo: s.tipo,
        impactoMxn: s.impactoMxn,
      });
      s.estado = "aceptada";
      await this.repo.actualizar(analisis.id, analisis.contenido);
      await this.bitacora.registrarOperacion(ctx, {
        entidad: "sugerencias_ia",
        entidadId: id,
        folio: analisis.lote,
        accion: "ACTUALIZAR",
        nuevo: { estado: s.estado, hallazgo: h.tracking_id },
      });
      return { ...h, sugerenciaId: id, estadoSugerencia: s.estado };
    } finally {
      this.procesando.delete(id);
    }
  }

  async descartar(ctx: Contexto, id: number, motivo: string) {
    const { analisis, s } = await this.pendienteVisible(ctx.usuario, id);
    s.estado = "descartada";
    s.motivoDescarte = motivo.trim();
    await this.repo.actualizar(analisis.id, analisis.contenido);
    await this.bitacora.registrarOperacion(ctx, {
      entidad: "sugerencias_ia",
      entidadId: id,
      folio: analisis.lote,
      accion: "RECHAZAR",
      nuevo: { estado: s.estado, motivo: s.motivoDescarte },
    });
    return { id, estado: s.estado };
  }
}
