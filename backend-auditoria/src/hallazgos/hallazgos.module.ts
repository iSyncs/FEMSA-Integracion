import { Module } from '@nestjs/common';
import { HallazgosController } from './hallazgos.controller';
import { HallazgosService } from './hallazgos.service';

@Module({ controllers: [HallazgosController], providers: [HallazgosService], exports: [HallazgosService] })
export class HallazgosModule {}
