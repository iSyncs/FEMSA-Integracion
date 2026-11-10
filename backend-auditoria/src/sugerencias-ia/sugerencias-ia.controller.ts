import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { AnalizarEvidenciaDto, DescartarSugerenciaDto } from './sugerencias-ia.dto';
import { SugerenciasIaService } from './sugerencias-ia.service';

@ApiTags('IA · Sugerencias')
@ApiCookieAuth('femsa_sesion')
@Controller('ia/sugerencias')
export class SugerenciasIaController {
  constructor(private readonly sugerencias: SugerenciasIaService) {}

  @Get()
  @ApiOperation({ summary: 'Documentos clasificados, evidencia faltante y borradores pendientes visibles' })
  listar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.sugerencias.listar(usuario);
  }

  @Post('analizar')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Analiza texto documental con OpenRouter y crea sugerencias pendientes' })
  analizar(@ContextoPeticion() ctx: Contexto, @Body() dto: AnalizarEvidenciaDto) {
    return this.sugerencias.analizar(ctx, dto);
  }

  @Post(':id/aceptar')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Acepta una sugerencia y crea un hallazgo oficial' })
  aceptar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number) {
    return this.sugerencias.aceptar(ctx, id);
  }

  @Post(':id/descartar')
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Descarta una sugerencia conservando el motivo y la trazabilidad' })
  descartar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number, @Body() dto: DescartarSugerenciaDto) {
    return this.sugerencias.descartar(ctx, id, dto.motivo);
  }
}
