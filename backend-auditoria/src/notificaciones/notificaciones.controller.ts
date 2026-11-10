import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Publico, Roles, UsuarioActual } from "../auth/decoradores";
import type { UsuarioSesion } from "../datos/repositorios/vistas";
import { ConsultarNotificacionesDto, SimularNotificacionesDto } from "./notificaciones.dto";
import { NotificacionesService } from "./notificaciones.service";

@ApiTags("Notificaciones")
@ApiCookieAuth("femsa_sesion")
@Controller("notificaciones")
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: "Bandeja del usuario: avisos recientes y cuántos faltan por leer" })
  bandeja(@UsuarioActual() usuario: UsuarioSesion, @Query() q: ConsultarNotificacionesDto) {
    return this.notificaciones.bandeja(usuario, q.estado === "no_leidas");
  }

  @Post("leidas")
  @ApiOperation({ summary: "Marca todos los avisos como leídos" })
  marcarTodas(@UsuarioActual() usuario: UsuarioSesion) {
    return this.notificaciones.marcarTodas(usuario);
  }

  @Post("vencimientos")
  @Roles("lider", "admin")
  @ApiOperation({ summary: "Corre a mano la revisión diaria de vencimientos (15, 5 y 1 día; escalamiento)" })
  vencimientos() {
    return this.notificaciones.revisarVencimientos();
  }

  /** Vercel Cron llama por GET con `Authorization: Bearer <CRON_SECRET>`. */
  @Get("cron/vencimientos")
  @Publico()
  @ApiOperation({ summary: "Revisión diaria de vencimientos (Vercel Cron)" })
  cron(@Headers("authorization") autorizacion?: string) {
    const secreto = process.env.CRON_SECRET;
    if (!secreto || autorizacion !== `Bearer ${secreto}`) throw new UnauthorizedException("Cron no autorizado.");
    return this.notificaciones.revisarVencimientos();
  }

  @Post("simular")
  @ApiOperation({ summary: "Llena tu bandeja con un aviso de cada tipo (pruebas y demo)" })
  simular(@UsuarioActual() usuario: UsuarioSesion, @Body() dto: SimularNotificacionesDto) {
    return this.notificaciones.simular(usuario, dto.retrasoSegundos ?? 0);
  }

  @Post(":id/leida")
  @ApiOperation({ summary: "Marca un aviso como leído" })
  marcarLeida(@UsuarioActual() usuario: UsuarioSesion, @Param("id", ParseIntPipe) id: number) {
    return this.notificaciones.marcarLeida(usuario, id);
  }
}
