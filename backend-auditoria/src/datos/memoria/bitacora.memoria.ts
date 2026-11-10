import { Injectable } from "@nestjs/common";
import { BaseDeDatosMemoria } from "./base-de-datos-memoria";
import {
  AccesoVista,
  BitacoraRepository,
  FiltrosAccesos,
  FiltrosOperaciones,
  NuevaOperacion,
  NuevoAcceso,
  OperacionVista,
} from "../repositorios/bitacora.repository";
import type { RegistroBitacora } from "../modelos";

@Injectable()
export class BitacoraMemoriaRepository extends BitacoraRepository {
  constructor(private readonly db: BaseDeDatosMemoria) {
    super();
  }

  private usuario(id: number | null) {
    const u = this.db.usuarios.find((x) => x.id === id);
    return {
      usuario: u?.nombre ?? null,
      rol: u ? (this.db.roles.find((r) => r.id === u.rol_id)?.clave ?? null) : null,
    };
  }

  /** Misma regla que la consulta SQL: cada entidad lleva a su auditoría. */
  private auditoriaDe(b: RegistroBitacora): number | null {
    const id = b.entidad_id;
    const procedimiento = (pid: number | null | undefined) =>
      this.db.procedimientos.find((p) => p.id === pid)?.auditoria_id ?? null;
    switch (b.entidad) {
      case "auditorias":
        return id;
      case "hallazgos":
        return this.db.hallazgos.find((h) => h.id === id)?.auditoria_id ?? null;
      case "planes": {
        const plan = this.db.planes.find((p) => p.id === id);
        return this.db.hallazgos.find((h) => h.id === plan?.hallazgo_id)?.auditoria_id ?? null;
      }
      case "evidencias":
        return procedimiento(this.db.evidencias.find((e) => e.id === id)?.procedimiento_id);
      case "procedimientos_auditoria":
        return procedimiento(id);
      case "aprobaciones":
        return this.db.aprobaciones.find((a) => a.id === id)?.auditoria_id ?? null;
      default: {
        // Lotes y análisis de IA viven en otros repositorios: se usa el folio de auditoría que guardan en el detalle.
        const folio = (b.detalle ?? "").match(/AUD-\d{6}/)?.[0];
        return (
          this.db.auditorias.find((a) => a.tracking_id === folio)?.id ??
          (b.entidad === "sugerencias_ia" && b.accion === "CREAR" ? id : null)
        );
      }
    }
  }

  async agregarOperacion(datos: NuevaOperacion) {
    // la fecha se guarda en utc, como el default de la tabla en sql
    const registro = { id: this.db.siguienteId("bitacora"), ...datos, fecha: new Date() };
    this.db.bitacora.push(registro);
    return structuredClone(registro);
  }

  async agregarAcceso(datos: NuevoAcceso) {
    const registro = { id: this.db.siguienteId("accesos"), ...datos, fecha: new Date() };
    this.db.accesos.push(registro);
    return structuredClone(registro);
  }

  async operaciones(f: FiltrosOperaciones) {
    const texto = f.texto?.trim().toLowerCase();
    const filas: OperacionVista[] = this.db.bitacora
      .map((b) => {
        const auditoria = this.db.auditorias.find((a) => a.id === this.auditoriaDe(b));
        return {
          ...structuredClone(b),
          ...this.usuario(b.usuario_id),
          auditoria_id: auditoria?.id ?? null,
          auditoria_folio: auditoria?.tracking_id ?? null,
          auditoria: auditoria?.nombre ?? null,
        };
      })
      .filter(
        (b) =>
          b.fecha >= f.limiteFecha &&
          (!f.desde || b.fecha >= f.desde) &&
          (!f.hasta || b.fecha <= f.hasta) &&
          (!f.usuarioId || b.usuario_id === f.usuarioId) &&
          (!f.accion || b.accion === f.accion) &&
          (!f.entidad || b.entidad === f.entidad) &&
          (!f.auditoriaId || b.auditoria_id === f.auditoriaId) &&
          (!texto ||
            [b.folio, b.usuario, b.auditoria_folio, b.auditoria].some((x) => x?.toLowerCase().includes(texto))),
      )
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id);
    return { filas: filas.slice(f.inicio, f.inicio + f.limite), total: filas.length };
  }

  async accesos(f: FiltrosAccesos) {
    const texto = f.texto?.trim().toLowerCase();
    const filas: AccesoVista[] = this.db.accesos
      .map((h) => ({ ...structuredClone(h), ...this.usuario(h.usuario_id) }))
      .filter(
        (h) =>
          h.fecha >= f.limiteFecha &&
          (!f.desde || h.fecha >= f.desde) &&
          (!f.hasta || h.fecha <= f.hasta) &&
          (!f.usuarioId || h.usuario_id === f.usuarioId) &&
          (!f.resultado || h.resultado === f.resultado) &&
          (!texto || [h.usuario, h.correo, h.ip].some((x) => x?.toLowerCase().includes(texto))),
      )
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id);
    return { filas: filas.slice(f.inicio, f.inicio + f.limite), total: filas.length };
  }
}
