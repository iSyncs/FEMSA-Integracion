import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { IaService } from './ia.service';
import { ClasificarDto, CompletitudDto, HallazgoIaDto, PlanIaDto, ResumenIaDto } from './ia.dto';

@ApiTags('FE1S-24 · Inteligencia artificial')
@ApiCookieAuth('femsa_sesion')
@Controller('ia')
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Proveedor y modelo configurados; la pantalla muestra "IA no disponible" si no lo está' })
  estado() {
    return this.ia.estado();
  }

  @Post('clasificar')
  @HttpCode(200)
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Sugiere tipo de documento y procedimiento al que corresponde' })
  clasificar(@UsuarioActual() u: UsuarioSesion, @Body() dto: ClasificarDto) {
    return this.ia.ejecutar(u, 'clasificar', dto);
  }

  @Post('completitud')
  @HttpCode(200)
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Detecta documentos faltantes y redacta el mensaje para el auditado' })
  completitud(@UsuarioActual() u: UsuarioSesion, @Body() dto: CompletitudDto) {
    return this.ia.ejecutar(u, 'completitud', dto);
  }

  @Post('hallazgo')
  @HttpCode(200)
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Sugiere un hallazgo (condición, criterio, causa, efecto, recomendación y severidad)' })
  hallazgo(@UsuarioActual() u: UsuarioSesion, @Body() dto: HallazgoIaDto) {
    return this.ia.ejecutar(u, 'hallazgo', dto);
  }

  @Post('plan')
  @HttpCode(200)
  @Roles('auditor', 'lider', 'auditado')
  @ApiOperation({ summary: 'Sugiere un plan de remediación para un hallazgo' })
  plan(@UsuarioActual() u: UsuarioSesion, @Body() dto: PlanIaDto) {
    return this.ia.ejecutar(u, 'plan', dto);
  }

  @Post('resumen')
  @HttpCode(200)
  @Roles('auditor', 'lider', 'jefe', 'gerente', 'director')
  @ApiOperation({ summary: 'Resumen ejecutivo de los hallazgos de una auditoría' })
  resumen(@UsuarioActual() u: UsuarioSesion, @Body() dto: ResumenIaDto) {
    return this.ia.ejecutar(u, 'resumen', dto);
  }
}
