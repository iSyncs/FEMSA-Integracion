import { Module } from '@nestjs/common';
import { HallazgosModule } from '../hallazgos/hallazgos.module';
import { SugerenciasIaController } from './sugerencias-ia.controller';
import { SugerenciasIaService } from './sugerencias-ia.service';
import { OpenRouterService } from './openrouter.service';
import { EvidenciasModule } from '../evidencias/evidencias.module';
import { ContenidoEvidenciaService } from './contenido-evidencia.service';

@Module({ imports: [HallazgosModule, EvidenciasModule], controllers: [SugerenciasIaController], providers: [SugerenciasIaService, OpenRouterService, ContenidoEvidenciaService], exports: [SugerenciasIaService] })
export class SugerenciasIaModule {}
