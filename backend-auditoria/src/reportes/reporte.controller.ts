import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { ReportesService } from './reportes.service';

@ApiTags('HU_13 · Informe ejecutivo')
@ApiCookieAuth('femsa_sesion')
@Roles('auditor', 'lider', 'jefe', 'gerente', 'director')
@Controller('reporte')
export class ReporteController {
  constructor(private readonly reportes: ReportesService, private readonly bitacora: BitacoraService) {}

  @Get()
  @ApiOperation({ summary: 'Datos del informe ejecutivo: indicadores, auditorías, hallazgos principales, planes demorados y expedientes sellados' })
  ejecutivo(@UsuarioActual() usuario: UsuarioSesion) {
    return this.reportes.ejecutivo(usuario);
  }

  @Post('exportaciones')
  @HttpCode(204)
  @ApiOperation({ summary: 'Registra en la bitácora que se descargó el informe en PDF' })
  async exportacion(@ContextoPeticion() ctx: Contexto) {
    await this.bitacora.registrarOperacion(ctx, { entidad: 'reporte', entidadId: 0, folio: 'INFORME-EJECUTIVO', accion: 'EXPORTAR', nuevo: { formato: 'pdf' } });
  }
}
