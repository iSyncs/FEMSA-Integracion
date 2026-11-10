import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { waitUntil } from "@vercel/functions";
import { AccesoService } from "../auth/acceso.service";
import type { Contexto } from "../auth/decoradores";
import { BitacoraService } from "../bitacora/bitacora.service";
import { noEncontrado, prohibido } from "../common/errores";
import { AuditoriasRepository } from "../datos/repositorios/auditorias.repository";
import { EvidenciasRepository } from "../datos/repositorios/evidencias.repository";
import { Lote, LotesRepository } from "../datos/repositorios/lotes.repository";
import { UsuariosRepository } from "../datos/repositorios/usuarios.repository";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { SugerenciasIaService } from "../sugerencias-ia/sugerencias-ia.service";
import { NotificacionesService } from "../notificaciones/notificaciones.service";
import { PbcService, POR_RESPONDER } from "../pbc/pbc.service";
import type { RecibirLoteDto } from "./lotes.dto";

// Un lote que quedó "analizando" más de 2 minutos (p. ej. el servidor se reinició) se vuelve a tomar.
const ATORADO_MS = 2 * 60_000;
// Respaldo del demo: documentos de prueba que simulan la respuesta de Tesorería en AUD-000002.
const ESPERA_REINTENTO_MS = process.env.NODE_ENV === "test" ? 0 : 4000;
const PREFERIDOS = [/autorizacion_pago/i, /factura/i, /conciliacion/i];

@Injectable()
export class LotesService {
  private readonly log = new Logger(LotesService.name);
  private readonly enProceso = new Set<number>();

  /** Lanza el análisis sin hacer esperar al usuario. En Vercel, waitUntil mantiene viva la función hasta que termine. */
  private enSegundoPlano(id: number) {
    const tarea = this.procesar(id);
    try {
      waitUntil(tarea);
    } catch {
      /* Fuera de Vercel basta con la promesa. */
    }
  }

  constructor(
    private readonly repo: LotesRepository,
    private readonly evidencias: EvidenciasRepository,
    private readonly auditorias: AuditoriasRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly acceso: AccesoService,
    private readonly bitacora: BitacoraService,
    private readonly sugerencias: SugerenciasIaService,
    private readonly notificaciones: NotificacionesService,
    private readonly pbc: PbcService,
  ) {}

  async solicitudes(usuario: UsuarioSesion, auditoriaId: number) {
    return this.pbc.listar(usuario, { auditoriaId });
  }

  /** Versión mínima de HU_05 (una solicitud por procedimiento); la completa vive en /api/pbc. */
  solicitar(ctx: Contexto, auditoriaId: number, procedimientoId: number) {
    return this.pbc.crearSimple(ctx, auditoriaId, procedimientoId);
  }

  /** Llega un lote: lo registra y la IA empieza a analizarlo sin esperar a que alguien lo pida. */
  async recibir(ctx: Contexto, dto: RecibirLoteDto) {
    const auditoria = await this.acceso.auditoriaAbierta(ctx.usuario, dto.auditoriaId);
    const ids = [...new Set(dto.evidencias)];
    for (const id of ids) {
      const e = await this.evidencias.buscar(id);
      if (!e || e.auditoria_id !== auditoria.id || e.eliminado || e.evidencia_padre_id)
        throw new BadRequestException("Alguna evidencia no pertenece a la auditoría.");
      if (ctx.usuario.rol === "auditado" && e.cargado_por_id !== ctx.usuario.id)
        throw prohibido("Sólo puedes enviar evidencia que tú cargaste.");
    }
    if ((await this.repo.enLote(ids)).length) throw new ConflictException("Alguna evidencia ya se envió en otro lote.");
    const solicitud = dto.solicitudPbcId
      ? (await this.pbc.listar(ctx.usuario, { auditoriaId: auditoria.id })).find((s) => s.id === dto.solicitudPbcId)
      : undefined;
    if (dto.solicitudPbcId && !solicitud) throw new BadRequestException("La solicitud no pertenece a la auditoría.");
    if (solicitud && !POR_RESPONDER.includes(solicitud.estado))
      throw new ConflictException(`La solicitud ${solicitud.tracking_id} ya fue respondida.`);
    const lote = await this.registrar(ctx, {
      auditoriaId: auditoria.id,
      solicitudPbcId: solicitud?.id ?? null,
      enviadoPor: ctx.usuario.id,
      evidencias: ids,
      asunto:
        dto.asunto?.trim() ||
        `Respuesta a ${solicitud ? `${solicitud.tracking_id}: ${solicitud.asunto ?? solicitud.procedimiento}` : "una solicitud de información"}`,
    });
    if (solicitud) await this.pbc.marcarEnviada(ctx, solicitud.id, lote.tracking_id);
    return lote;
  }

  /** Respaldo para el demo: arma un lote con documentos de prueba ya cargados, como si el área auditada los enviara. */
  async simular(ctx: Contexto, auditoriaId: number) {
    const auditoria = await this.acceso.auditoriaAbierta(ctx.usuario, auditoriaId);
    const usadas = new Set(await this.repo.enLote((await this.auditorias.evidencias(auditoria.id)).map((e) => e.id)));
    const pdfs = (await this.auditorias.evidencias(auditoria.id)).filter(
      (e) => !e.evidencia_padre_id && !e.eliminado && e.tipo_mime === "application/pdf" && !usadas.has(e.id),
    );
    const elegidos = PREFERIDOS.map((re) => pdfs.find((e) => re.test(e.nombre_archivo))).filter((e) => !!e);
    const documentos = (elegidos.length ? elegidos : pdfs).slice(0, 3);
    if (!documentos.length) throw new ConflictException("No quedan documentos PDF sin enviar en esta auditoría.");
    const auditados = (await this.usuarios.listarActivos()).filter((u) => u.rol === "auditado");
    let remitente: UsuarioSesion = ctx.usuario;
    for (const u of auditados)
      if ((await this.auditorias.auditoriasDeParticipante(u.id)).includes(auditoria.id)) {
        remitente = u;
        break;
      }
    return this.registrar(
      { ...ctx, usuario: remitente },
      {
        auditoriaId: auditoria.id,
        solicitudPbcId: null,
        enviadoPor: remitente.id,
        evidencias: documentos.map((e) => e.id),
        asunto: `Respuesta a la solicitud de información de ${auditoria.tracking_id}`,
      },
    );
  }

  private async registrar(ctx: Contexto, datos: Parameters<LotesRepository["crear"]>[0]) {
    const lote = await this.repo.crear(datos);
    await this.bitacora.registrarOperacion(ctx, {
      entidad: "lotes",
      entidadId: lote.id,
      folio: lote.tracking_id,
      accion: "CREAR",
      nuevo: {
        auditoria: lote.auditoria_folio,
        documentos: lote.total,
        enviado_por: lote.enviado_por,
      },
    });
    const auditoria = await this.auditorias.buscar(lote.auditoria_id);
    if (auditoria && auditoria.lider_id !== ctx.usuario.id) {
      await this.notificaciones.avisar([auditoria.lider_id], {
        tipo: "lote_recibido",
        auditoriaId: lote.auditoria_id,
        mensaje: `${lote.auditoria_folio}: ${lote.enviado_por} envió ${lote.total} documento${lote.total === 1 ? "" : "s"} (${lote.tracking_id}). La IA ya los está revisando.`,
      });
    }
    this.enSegundoPlano(lote.id);
    return lote;
  }

  /** Analiza cada PDF del lote con la IA. Corre en segundo plano; el estado queda en la base. */
  async procesar(id: number) {
    if (this.enProceso.has(id)) return;
    this.enProceso.add(id);
    try {
      const lote = await this.repo.buscar(id);
      if (!lote || lote.estado === "listo") return;
      const usuario = await this.usuarios.buscarActivo(lote.enviado_por_id);
      if (!usuario) throw new Error("El remitente del lote ya no está activo.");
      const ctx: Contexto = { usuario, ip: null, zonaHoraria: usuario.zona_horaria };
      await this.repo.actualizar(id, { estado: "analizando", inicio: new Date(), error: null, analizados: 0 });
      const errores: string[] = [];
      let analizados = 0,
        pdfs = 0;
      for (const doc of lote.documentos) {
        if (doc.tipo_mime === "application/pdf") {
          pdfs++;
          // El modelo gratuito a veces responde vacío: cada documento tiene hasta 3 intentos antes de marcar error.
          for (let intento = 1; intento <= 3; intento++) {
            try {
              await this.sugerencias.analizar(
                ctx,
                { auditoriaId: lote.auditoria_id, evidenciaId: doc.id },
                lote.tracking_id,
              );
              break;
            } catch (e) {
              if (intento === 3) errores.push(`${doc.nombre_archivo}: ${(e as Error).message}`);
              else await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS));
            }
          }
        }
        await this.repo.actualizar(id, { analizados: ++analizados });
      }
      const estado = pdfs > 0 && errores.length === pdfs ? "error" : "listo";
      await this.repo.actualizar(id, { estado, fin: new Date(), error: errores.join(" · ").slice(0, 500) || null });
      await this.bitacora.registrarOperacion(ctx, {
        entidad: "lotes",
        entidadId: id,
        folio: lote.tracking_id,
        accion: "ACTUALIZAR",
        nuevo: {
          estado,
          analizados,
          errores: errores.length,
        },
      });
      const auditoria = await this.auditorias.buscar(lote.auditoria_id);
      await this.notificaciones.avisar([auditoria?.lider_id], {
        tipo: estado === "listo" ? "analisis_listo" : "analisis_error",
        auditoriaId: lote.auditoria_id,
        mensaje:
          estado === "listo"
            ? `${lote.tracking_id}: la IA terminó de revisar ${pdfs} documento${pdfs === 1 ? "" : "s"}${errores.length ? ` (${errores.length} con error)` : ""}.`
            : `${lote.tracking_id}: la IA no pudo revisar los documentos. Puedes reintentar el análisis.`,
      });
    } catch (e) {
      this.log.error(`Lote ${id}: ${(e as Error).message}`);
      await this.repo
        .actualizar(id, { estado: "error", fin: new Date(), error: (e as Error).message.slice(0, 500) })
        .catch(() => undefined);
    } finally {
      this.enProceso.delete(id);
    }
  }

  private async visibles(usuario: UsuarioSesion, lotes: Lote[]) {
    const permitidas = new Set<number>();
    for (const id of new Set(lotes.map((l) => l.auditoria_id))) {
      try {
        await this.acceso.auditoriaVisible(usuario, id);
        permitidas.add(id);
      } catch {
        /* Seguridad por fila. */
      }
    }
    return lotes.filter(
      (l) => permitidas.has(l.auditoria_id) && (usuario.rol !== "auditado" || l.enviado_por_id === usuario.id),
    );
  }

  async listar(usuario: UsuarioSesion) {
    const lotes = await this.visibles(usuario, await this.repo.listar());
    const ahora = Date.now();
    for (const l of lotes) {
      const atorado =
        l.estado === "pendiente" ||
        (l.estado === "analizando" && l.inicio && ahora - new Date(l.inicio).getTime() > ATORADO_MS);
      if (atorado && !this.enProceso.has(l.id)) this.enSegundoPlano(l.id);
    }
    return lotes.map(({ documentos, ...l }) => ({ ...l, documentos: documentos.length }));
  }

  async detalle(usuario: UsuarioSesion, id: number) {
    const lote = await this.repo.buscar(id);
    if (!lote || !(await this.visibles(usuario, [lote])).length) throw noEncontrado("Lote");
    const atorado =
      lote.estado === "pendiente" ||
      (lote.estado === "analizando" && lote.inicio && Date.now() - new Date(lote.inicio).getTime() > ATORADO_MS);
    if (atorado && !this.enProceso.has(lote.id)) this.enSegundoPlano(lote.id);
    // El área auditada ve el estado de su envío, no lo que propuso la IA.
    if (usuario.rol === "auditado") return { ...lote, resultados: null };
    const resultados = await this.sugerencias.deEvidencias(
      lote.auditoria_id,
      lote.documentos.map((d) => d.id),
    );
    return { ...lote, resultados };
  }

  async reanalizar(ctx: Contexto, id: number) {
    const lote = await this.repo.buscar(id);
    if (!lote || !(await this.visibles(ctx.usuario, [lote])).length) throw noEncontrado("Lote");
    if (lote.estado === "analizando") throw new ConflictException("El lote se está analizando.");
    await this.repo.actualizar(id, { estado: "pendiente" });
    this.enSegundoPlano(id);
    return { id, estado: "pendiente" };
  }
}
