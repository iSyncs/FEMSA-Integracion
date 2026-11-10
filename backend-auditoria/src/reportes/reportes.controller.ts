import { Controller, Get } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsuarioActual } from "../auth/decoradores";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { ReportesService } from "./reportes.service";

@ApiTags("HU_14 · Tableros de control")
@ApiCookieAuth("femsa_sesion")
@Controller("dashboard")
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get()
  @ApiOperation({
    summary: "Indicadores agregados: hallazgos por severidad y tipo, procedimientos por estado y semáforo de planes",
  })
  resumen(@UsuarioActual() usuario: UsuarioSesion) {
    return this.reportes.resumen(usuario);
  }

  @Get("cuellos-de-botella")
  @ApiOperation({
    summary:
      "Dónde se atora el trabajo: auditorías detenidas en aprobación, procedimientos estancados y hallazgos sin plan",
  })
  cuellosDeBotella(@UsuarioActual() usuario: UsuarioSesion) {
    return this.reportes.cuellosDeBotella(usuario);
  }
}
