import { Injectable } from "@nestjs/common";
import { ColumnaCsv, celdaCsv, csvDeColumnas } from "../common/utils/csv";
import { BitacoraRepository, NuevoAcceso, OperacionVista } from "../datos/repositorios/bitacora.repository";
import type { Contexto } from "../auth/decoradores";
import {
  AccionBitacora,
  ConsultarAccesosDto,
  ConsultarBitacoraDto,
  ConsultarOperacionesDto,
  ExportarBitacoraDto,
} from "./bitacora.dto";
import { RETENCION_ACCESOS_DIAS, RETENCION_OPERACIONES_DIAS } from "./retencion";

export interface Operacion {
  entidad: string;
  entidadId: number;
  folio: string;
  accion: AccionBitacora;
  anterior?: unknown;
  nuevo?: unknown;
}

export interface Cambio {
  campo: string;
  antes: unknown;
  despues: unknown;
}

const UN_DIA_MS = 86_400_000;
const LIMITE_EXPORTACION = 5000;

/**
 * FE1S-36 · Pasa el detalle guardado a una lista de cambios legible. Las operaciones nuevas guardan
 * { anterior, nuevo }; las antiguas guardan un objeto plano, que se muestra como valores nuevos.
 */
export function cambiosDe(detalle: string | null): Cambio[] {
  if (!detalle) return [];
  let d: unknown;
  try {
    d = JSON.parse(detalle);
  } catch {
    return [{ campo: "detalle", antes: null, despues: detalle }];
  }
  if (!d || typeof d !== "object") return [];
  const o = d as Record<string, unknown>;
  const conForma = "anterior" in o || "nuevo" in o;
  const antes = (conForma ? o.anterior : null) as Record<string, unknown> | null;
  const despues = (conForma ? o.nuevo : o) as Record<string, unknown> | null;
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])];
  return campos
    .map((campo) => ({ campo, antes: antes?.[campo] ?? null, despues: despues?.[campo] ?? null }))
    .filter((c) => JSON.stringify(c.antes) !== JSON.stringify(c.despues));
}

const rango = (f: ConsultarBitacoraDto) => ({
  desde: f.desde ? new Date(`${f.desde}T00:00:00.000Z`) : undefined,
  hasta: f.hasta ? new Date(`${f.hasta}T23:59:59.999Z`) : undefined,
});

// hu_15: bitacora de solo agregar, aqui solo hay metodos para registrar y consultar
@Injectable()
export class BitacoraService {
  constructor(private readonly repo: BitacoraRepository) {}

  registrarAcceso(datos: NuevoAcceso) {
    return this.repo.agregarAcceso(datos);
  }

  registrarOperacion(ctx: Contexto, op: Operacion) {
    return this.repo.agregarOperacion({
      entidad: op.entidad,
      entidad_id: op.entidadId,
      folio: op.folio,
      accion: op.accion,
      usuario_id: ctx.usuario.id,
      // el valor anterior y el nuevo se guardan juntos como json, igual que la columna detalle en sql
      detalle: JSON.stringify({ anterior: op.anterior ?? null, nuevo: op.nuevo ?? null }),
      ip: ctx.ip,
      zona_horaria: ctx.zonaHoraria,
    });
  }

  /** Feed de operaciones: los registros fuera de retención (90 días) ya no se muestran en línea. */
  async operaciones(f: ConsultarOperacionesDto, ahora: Date = new Date()) {
    const pagina = f.pagina ?? 1;
    const limite = f.limite ?? 50;
    const r = await this.repo.operaciones({
      limiteFecha: new Date(ahora.getTime() - RETENCION_OPERACIONES_DIAS * UN_DIA_MS),
      ...rango(f),
      usuarioId: f.usuarioId,
      accion: f.accion,
      entidad: f.entidad,
      auditoriaId: f.auditoriaId,
      texto: f.texto ?? f.folio,
      inicio: (pagina - 1) * limite,
      limite,
    });
    return {
      filas: r.filas.map((o: OperacionVista) => ({ ...o, cambios: cambiosDe(o.detalle) })),
      total: r.total,
      pagina,
      limite,
    };
  }

  /** Accesos: retención de 30 días. */
  async accesos(f: ConsultarAccesosDto, ahora: Date = new Date()) {
    const pagina = f.pagina ?? 1;
    const limite = f.limite ?? 50;
    const r = await this.repo.accesos({
      limiteFecha: new Date(ahora.getTime() - RETENCION_ACCESOS_DIAS * UN_DIA_MS),
      ...rango(f),
      usuarioId: f.usuarioId,
      resultado: f.resultado,
      texto: f.texto,
      inicio: (pagina - 1) * limite,
      limite,
    });
    return { ...r, pagina, limite };
  }

  /** Vista combinada de la primera versión (HU_15); se conserva para no romper a quien la use. */
  async consultar(f: ConsultarBitacoraDto, ahora: Date = new Date()) {
    const [operaciones, accesos] = await Promise.all([
      this.operaciones({ ...f, limite: f.limite ?? 100 }, ahora),
      this.accesos({ ...f, limite: f.limite ?? 100 }, ahora),
    ]);
    return {
      operaciones: operaciones.filas,
      accesos: accesos.filas,
      pagina: operaciones.pagina,
      limite: operaciones.limite,
      totales: { operaciones: operaciones.total, accesos: accesos.total },
    };
  }

  /** CSV de lo filtrado (hasta 5,000 filas). La exportación misma queda en la bitácora. */
  async exportar(ctx: Contexto, f: ExportarBitacoraDto) {
    const tipo = f.tipo ?? "operaciones";
    const filtro = { ...f, pagina: 1, limite: LIMITE_EXPORTACION };
    // Solo salen las columnas pedidas, en el orden fijo de abajo; si no piden ninguna válida, salen todas.
    const pedidas = new Set((f.columnas ?? "").split(",").filter(Boolean));
    const elegir = <T>(cols: ColumnaCsv<T>[]) => {
      const sel = cols.filter(([id]) => pedidas.has(id));
      return sel.length ? sel : cols;
    };
    let contenido: string;
    let total: number;
    if (tipo === "accesos") {
      const r = await this.repo.accesos({
        limiteFecha: new Date(Date.now() - RETENCION_ACCESOS_DIAS * UN_DIA_MS),
        ...rango(f),
        usuarioId: f.usuarioId,
        resultado: f.resultado,
        texto: f.texto,
        inicio: 0,
        limite: LIMITE_EXPORTACION,
      });
      type Acceso = (typeof r.filas)[number];
      const cols = elegir<Acceso>([
        ["fecha_utc", (a) => a.fecha],
        ["usuario", (a) => a.usuario],
        ["correo", (a) => a.correo],
        ["resultado", (a) => a.resultado],
        ["ip", (a) => a.ip],
        ["navegador", (a) => a.agente],
        ["zona_horaria", (a) => a.zona_horaria],
      ]);
      total = r.filas.length;
      contenido = csvDeColumnas(cols, r.filas);
    } else {
      const r = await this.operaciones(filtro);
      type Operacion = (typeof r.filas)[number];
      const cols = elegir<Operacion>([
        ["fecha_utc", (o) => o.fecha],
        ["usuario", (o) => o.usuario],
        ["rol", (o) => o.rol],
        ["accion", (o) => o.accion],
        ["entidad", (o) => o.entidad],
        ["folio", (o) => o.folio],
        ["auditoria", (o) => o.auditoria_folio],
        [
          "cambios",
          (o) =>
            o.cambios.map((c) => `${c.campo}: ${celdaCsv(c.antes) || "—"} → ${celdaCsv(c.despues) || "—"}`).join(" | "),
        ],
        ["ip", (o) => o.ip],
        ["zona_horaria", (o) => o.zona_horaria],
      ]);
      total = r.filas.length;
      contenido = csvDeColumnas(cols, r.filas);
    }
    await this.registrarOperacion(ctx, {
      entidad: "bitacora",
      entidadId: 0,
      folio: `BITACORA-${tipo.toUpperCase()}`,
      accion: "EXPORTAR",
      nuevo: { tipo, filas: total, columnas: f.columnas ?? "todas" },
    });
    return contenido;
  }
}
