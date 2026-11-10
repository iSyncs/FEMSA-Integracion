import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles, UsuarioActual } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { HallazgosService } from './hallazgos.service';
import { CrearHallazgoDto } from './hallazgos.dto';

@ApiTags('HU_04 · Hallazgos')
@ApiCookieAuth('femsa_sesion')
@Controller('hallazgos')
export class HallazgosController {
  constructor(private readonly hallazgos: HallazgosService) {}

  @Get()
  @ApiOperation({ summary: 'Hallazgos visibles, ordenados por severidad' })
  listar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.hallazgos.listar(usuario);
  }

  @Post()
  @Roles('auditor', 'lider')
  @ApiOperation({ summary: 'Registro metodológico del hallazgo (folio FND-###### automático)' })
  crear(@ContextoPeticion() ctx: Contexto, @Body() dto: CrearHallazgoDto) {
    return this.hallazgos.crear(ctx, dto);
  }
}
