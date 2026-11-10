import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { PlanesService } from './planes.service';
import { CrearPlanDto, RegistrarAvanceDto, ValidarPlanDto } from './planes.dto';

@ApiTags('HU_09 · HU_10 · HU_11 · Planes de remediación')
@ApiCookieAuth('femsa_sesion')
@Controller('planes')
export class PlanesController {
  constructor(private readonly planes: PlanesService) {}

  @Get()
  @ApiOperation({ summary: 'Planes visibles con semáforo (en tiempo, por vencer, demorado, cerrado)' })
  listar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.planes.listar(usuario);
  }

  @Get('avances')
  @Roles('director')
  @ApiOperation({ summary: 'Historial consolidado de avances de todos los planes (solo Director)' })
  avancesGenerales(@UsuarioActual() usuario: UsuarioSesion) {
    return this.planes.avancesGenerales(usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del plan con su historial de avances' })
  detalle(@UsuarioActual() usuario: UsuarioSesion, @Param('id', ParseIntPipe) id: number) {
    return this.planes.detalle(usuario, id);
  }

  @Post()
  @HttpCode(201)
  @Roles('auditor', 'lider', 'auditado')
  @ApiOperation({
    summary: 'Da de alta un plan de remediación',
  })
  crear(
    @ContextoPeticion() ctx: Contexto,
    @Body() dto: CrearPlanDto,
  ) {
    return this.planes.crear(ctx, dto);
  }

  @Post(':id/avances')
  @HttpCode(200)
  @Roles('auditado', 'auditor', 'lider')
  @ApiOperation({ summary: 'Captura de avance (0–100 %); al 100 % pasa a revisión GRC' })
  registrarAvance(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number, @Body() dto: RegistrarAvanceDto) {
    return this.planes.registrarAvance(ctx, id, dto);
  }

  @Post(':id/validacion')
  @HttpCode(200)
  @Roles('grc', 'jefe')
  @ApiOperation({ summary: 'Validación colegiada: GRC y después Jefatura; rechazo devuelve el plan a ejecución' })
  validar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number, @Body() dto: ValidarPlanDto) {
    return this.planes.validar(ctx, id, dto);
  }
}
