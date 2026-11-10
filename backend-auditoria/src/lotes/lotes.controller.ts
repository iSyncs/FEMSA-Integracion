import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { RecibirLoteDto, SimularLoteDto, SolicitarPbcDto } from './lotes.dto';
import { LotesService } from './lotes.service';

@ApiTags('IA · Lotes de evidencia')
@ApiCookieAuth('femsa_sesion')
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Get()
  @ApiOperation({ summary: 'Bandeja de lotes recibidos, con el estado del análisis de IA' })
  listar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.lotes.listar(usuario);
  }

  @Get('solicitudes')
  @ApiOperation({ summary: 'Solicitudes de información (PBC) de una auditoría' })
  solicitudes(@UsuarioActual() usuario: UsuarioSesion, @Query('auditoriaId', ParseIntPipe) auditoriaId: number) {
    return this.lotes.solicitudes(usuario, auditoriaId);
  }

  @Post('solicitudes')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Pide información al área auditada para un procedimiento' })
  solicitar(@ContextoPeticion() ctx: Contexto, @Body() dto: SolicitarPbcDto) {
    return this.lotes.solicitar(ctx, dto.auditoriaId, dto.procedimientoId);
  }

  @Post()
  @Roles('auditado', 'auditor', 'lider')
  @ApiOperation({ summary: 'Recibe un lote de evidencia; la IA lo analiza en segundo plano' })
  recibir(@ContextoPeticion() ctx: Contexto, @Body() dto: RecibirLoteDto) {
    return this.lotes.recibir(ctx, dto);
  }

  @Post('simular')
  @Roles('auditor', 'lider', 'admin')
  @ApiOperation({ summary: 'Simula la llegada de un lote con documentos de prueba (respaldo del demo)' })
  simular(@ContextoPeticion() ctx: Contexto, @Body() dto: SimularLoteDto) {
    return this.lotes.simular(ctx, dto.auditoriaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del lote con el resultado de la IA por documento' })
  detalle(@UsuarioActual() usuario: UsuarioSesion, @Param('id', ParseIntPipe) id: number) {
    return this.lotes.detalle(usuario, id);
  }

  @Post(':id/reanalizar')
  @Roles('lider')
  @ApiOperation({ summary: 'Vuelve a analizar un lote con error' })
  reanalizar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number) {
    return this.lotes.reanalizar(ctx, id);
  }
}
