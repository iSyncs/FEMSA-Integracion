import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { AccesoService } from "../auth/acceso.service";
import { HallazgosRepository } from "../datos/repositorios/hallazgos.repository";
import { conflicto } from "../common/errores";
import { BitacoraService } from "../bitacora/bitacora.service";
import type { Contexto } from "../auth/decoradores";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { CrearHallazgoDto } from "./hallazgos.dto";

@Injectable()
export class HallazgosService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly repo: HallazgosRepository,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(usuario: UsuarioSesion) {
    const visible = await this.acceso.filtro(usuario);
    return (await this.repo.listar())
      .filter((h) => visible(h) && (usuario.rol !== "auditado" || h.responsable_id === usuario.id))
      .map((h) => ({
        id: h.id,
        tracking_id: h.tracking_id,
        titulo: h.titulo,
        condicion: h.condicion,
        criterio: h.criterio,
        causa: h.causa,
        efecto: h.efecto,
        recomendacion: h.recomendacion,
        severidad: h.severidad,
        tipo: h.tipo,
        estado: h.estado,
        riesgo_residual: h.riesgo_residual,
        impacto_mxn: h.impacto_mxn,
        fecha_identificacion: h.fecha_identificacion,
        auditoria_id: h.auditoria_id,
        auditoria_folio: h.auditoria_folio,
        auditoria: h.auditoria,
        unidad: h.unidad,
        area: h.area,
        responsable: h.responsable,
        planes: h.planes,
        origen_ia: h.origen_ia,
      }));
  }

  async crear(ctx: Contexto, dto: CrearHallazgoDto) {
    const a = await this.acceso.auditoriaVisible(ctx.usuario, dto.auditoriaId);
    if (a.estado !== "pendiente" && a.estado !== "en_ejecucion")
      throw conflicto("Sólo se registran hallazgos en auditorías en ejecución.");
    if (dto.procedimientoId && !(await this.repo.procedimientoPerteneceA(dto.procedimientoId, a.id))) {
      throw new UnprocessableEntityException({
        error: "Revisa los campos marcados.",
        detalles: { procedimientoId: "El procedimiento no pertenece a la auditoría." },
      });
    }
    const h = await this.repo.crear({
      auditoria_id: a.id,
      procedimiento_id: dto.procedimientoId ?? null,
      titulo: dto.titulo.trim(),
      condicion: dto.condicion.trim(),
      criterio: dto.criterio.trim(),
      causa: dto.causa.trim(),
      efecto: dto.efecto.trim(),
      recomendacion: dto.recomendacion.trim(),
      severidad: dto.severidad,
      tipo: dto.tipo,
      impacto_mxn: dto.impactoMxn ?? null,
    });
    if (dto.procedimientoId) await this.repo.marcarProcedimientoConHallazgo(dto.procedimientoId);
    await this.bitacora.registrarOperacion(ctx, {
      entidad: "hallazgos",
      entidadId: h.id,
      folio: h.tracking_id,
      accion: "CREAR",
      nuevo: { titulo: h.titulo, severidad: h.severidad, estado: h.estado },
    });
    return { id: h.id, tracking_id: h.tracking_id, fecha_identificacion: h.fecha_identificacion };
  }
}
