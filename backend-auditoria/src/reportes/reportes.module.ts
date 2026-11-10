import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReporteController } from './reporte.controller';
import { ReportesService } from './reportes.service';

@Module({ controllers: [ReportesController, ReporteController], providers: [ReportesService] })
export class ReportesModule {}
