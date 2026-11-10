import { Controller, Get, Query, StreamableFile } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Contexto, ContextoPeticion, Roles } from "../auth/decoradores";
import { BitacoraService } from "./bitacora.service";
import {
  ConsultarAccesosDto,
  ConsultarBitacoraDto,
  ConsultarOperacionesDto,
  ExportarBitacoraDto,
} from "./bitacora.dto";

@ApiTags("HU_15 · Bitácora")
@ApiCookieAuth("femsa_sesion")
@Roles("director", "gerente", "admin")
@Controller("bitacora")
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get()
  @ApiOperation({ summary: "Operaciones (90 días) y accesos (30 días), con filtros y paginación" })
  consultar(@Query() filtros: ConsultarBitacoraDto) {
    return this.bitacora.consultar(filtros);
  }

  @Get("operaciones")
  @ApiOperation({ summary: "FE1S-36 · Feed de operaciones con su auditoría y los cambios antes y después" })
  operaciones(@Query() filtros: ConsultarOperacionesDto) {
    return this.bitacora.operaciones(filtros);
  }

  @Get("accesos")
  @ApiOperation({ summary: "FE1S-36 · Inicios y cierres de sesión, fallos y accesos denegados" })
  accesos(@Query() filtros: ConsultarAccesosDto) {
    return this.bitacora.accesos(filtros);
  }

  @Get("exportar")
  @ApiOperation({ summary: "FE1S-36 · Descarga en CSV lo filtrado; la exportación queda en la bitácora" })
  async exportar(@ContextoPeticion() ctx: Contexto, @Query() filtros: ExportarBitacoraDto) {
    const tipo = filtros.tipo ?? "operaciones";
    const fecha = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Buffer.from(await this.bitacora.exportar(ctx, filtros), "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="bitacora-${tipo}-${fecha}.csv"`,
    });
  }
}
