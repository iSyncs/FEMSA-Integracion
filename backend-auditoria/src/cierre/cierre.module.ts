import { Module } from '@nestjs/common';
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';
import { PrecierreService } from './precierre.service';
import { SelladoService } from './sellado.service';

@Module({
  controllers: [CierreController],
  providers: [CierreService, PrecierreService, SelladoService],
  exports: [PrecierreService],
})
export class CierreModule {}
