import { Module } from '@nestjs/common';
import { CierreModule } from '../cierre/cierre.module';
import { AuditoriasController } from './auditorias.controller';
import { AuditoriasService } from './auditorias.service';

@Module({ imports: [CierreModule], controllers: [AuditoriasController], providers: [AuditoriasService] })
export class AuditoriasModule {}
