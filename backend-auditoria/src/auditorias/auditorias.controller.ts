import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { AuditoriasService } from './auditorias.service';
import { CrearAuditoriaDto, EvaluarProcedimientoDto } from './auditorias.dto';

@ApiTags('Auditorías (HU_01 · seguridad por fila)')
@ApiCookieAuth('femsa_sesion')
@Controller('auditorias')
export class AuditoriasController {
  constructor(private readonly auditorias: AuditoriasService) {}

  @Get()
  @ApiOperation({ summary: 'Auditorías visibles para el usuario según su rol, Dirección o asignación' })
  listar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.auditorias.listar(usuario);
  }

  @Post()
  @Roles('lider', 'gerente', 'director')
  @ApiOperation({ summary: 'Crea una auditoría (folio AUD-###### automático)' })
  crear(@ContextoPeticion() ctx: Contexto, @Body() dto: CrearAuditoriaDto) {
    return this.auditorias.crear(ctx, dto);
  }

  @Post(':auditoriaId/procedimientos/:procedimientoId/evaluacion')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'F_02 · Evalúa diseño, efectividad y vulnerabilidad histórica (CP-003, CP-004)' })
  evaluarProcedimiento(
    @ContextoPeticion() ctx: Contexto,
    @Param('auditoriaId', ParseIntPipe) auditoriaId: number,
    @Param('procedimientoId', ParseIntPipe) procedimientoId: number,
    @Body() dto: EvaluarProcedimientoDto,
  ) {
    return this.auditorias.evaluarProcedimiento(ctx, auditoriaId, procedimientoId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Expediente: procedimientos, hallazgos, firmas, evidencias, sello y pre-cierre' })
  detalle(@UsuarioActual() usuario: UsuarioSesion, @Param('id', ParseIntPipe) id: number) {
    return this.auditorias.detalle(usuario, id);
  }
}
