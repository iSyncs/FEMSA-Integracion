import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoPeticion, Roles } from '../auth/decoradores';
import { CierreService } from './cierre.service';
import { DecisionDto } from './cierre.dto';

@ApiTags('HU_06 · HU_07 · HU_08 · Cierre')
@ApiCookieAuth('femsa_sesion')
@Controller('auditorias/:id')
export class CierreController {
  constructor(private readonly cierre: CierreService) {}

  @Post('solicitar-cierre')
  @HttpCode(200)
  @Roles('lider')
  @ApiOperation({ summary: 'Valida el pre-cierre y turna el expediente a la cadena de firmas' })
  solicitar(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number) {
    return this.cierre.solicitar(ctx, id);
  }

  @Post('decision')
  @HttpCode(200)
  @Roles('jefe', 'gerente', 'director')
  @ApiOperation({ summary: 'Aprobar o rechazar en el nivel en turno; la firma del Director sella con SHA-256' })
  decidir(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number, @Body() dto: DecisionDto) {
    return this.cierre.decidir(ctx, id, dto);
  }

  @Get('integridad')
  @ApiOperation({ summary: 'Recalcula el hash del expediente y lo compara con el sello' })
  integridad(@ContextoPeticion() ctx: Contexto, @Param('id', ParseIntPipe) id: number) {
    return this.cierre.integridad(ctx, id);
  }
}
