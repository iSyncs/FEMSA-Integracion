import { Body, Controller, Delete, Get, Headers, Param, ParseBoolPipe, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles } from '../auth/decoradores';
import { ConfirmarCargaDto, IniciarCargaDto } from './evidencias.dto';
import { EvidenciasService } from './evidencias.service';

@ApiTags('Evidencias (HU_03 · F_03 · CP-005)')
@ApiCookieAuth('femsa_sesion')
@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly service: EvidenciasService) {}

  @Post('cargas') @Roles('auditor', 'lider', 'auditado')
  @ApiOperation({ summary: 'Autoriza carga directa a Azure Blob con SAS de escritura de 10 minutos' })
  iniciar(@ContextoPeticion() ctx: Contexto, @Body() dto: IniciarCargaDto) { return this.service.iniciar(ctx, dto); }

  @Post('cargas/archivo') @Roles('auditor', 'lider', 'auditado')
  @ApiOperation({ summary: 'Sube el archivo a través de la API (máx. 4 MB) cuando el navegador no puede escribir directo en Azure' })
  subir(@ContextoPeticion() ctx: Contexto, @Headers('x-token-carga') token: string, @Req() req: Request) { return this.service.subirPorApi(ctx, token, req.body); }

  @Post('cargas/confirmar') @Roles('auditor', 'lider', 'auditado')
  @ApiOperation({ summary: 'Valida contenido/Defender/ZIP, calcula SHA-256 y registra SOPORTE' })
  confirmar(@ContextoPeticion() ctx: Contexto, @Body() dto: ConfirmarCargaDto) { return this.service.confirmar(ctx, dto); }

  @Get(':id/acceso')
  @ApiOperation({ summary: 'Genera SAS temporal de solo lectura para previsualizar o descargar' })
  acceso(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number,
    @Query('vistaPrevia', new ParseBoolPipe({ optional: true })) vistaPrevia = false) { return this.service.accesoArchivo(ctx, id, vistaPrevia); }

  @Delete(':id') @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Borrado lógico; el blob y la trazabilidad se conservan al menos 180 días' })
  eliminar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number) { return this.service.eliminar(ctx, id); }
}
