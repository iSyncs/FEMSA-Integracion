import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { ConsultarSolicitudesPbcDto, CrearSolicitudPbcDto, RevisarSolicitudPbcDto } from './pbc.dto';
import { PbcService } from './pbc.service';

@ApiTags('HU_05 · Solicitudes de información (PBC)')
@ApiCookieAuth('femsa_sesion')
@Controller('pbc')
export class PbcController {
  constructor(private readonly pbc: PbcService) {}

  @Get()
  @ApiOperation({ summary: 'Solicitudes visibles para el usuario, con puntos, días restantes y si están vencidas' })
  listar(@UsuarioActual() usuario: UsuarioSesion, @Query() filtros: ConsultarSolicitudesPbcDto) {
    return this.pbc.listar(usuario, filtros);
  }

  @Get('responsables')
  @ApiOperation({ summary: 'Usuarios auditados a quienes se les puede pedir información en una auditoría' })
  responsables(@UsuarioActual() usuario: UsuarioSesion, @Query('auditoriaId', ParseIntPipe) auditoriaId: number) {
    return this.pbc.responsables(usuario, auditoriaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una solicitud con sus puntos' })
  detalle(@UsuarioActual() usuario: UsuarioSesion, @Param('id', ParseIntPipe) id: number) {
    return this.pbc.detalle(usuario, id);
  }

  @Post()
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Pide documentos al área auditada: responsable, fecha límite y lista de puntos' })
  crear(@ContextoPeticion() ctx: Contexto, @Body() dto: CrearSolicitudPbcDto) {
    return this.pbc.crear(ctx, dto);
  }

  @Post(':id/revision')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Marca cada punto como cubierto o faltante y acepta la respuesta o pide corregirla' })
  revisar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number, @Body() dto: RevisarSolicitudPbcDto) {
    return this.pbc.revisar(ctx, id, dto);
  }
}
