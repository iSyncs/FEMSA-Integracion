import { Module } from '@nestjs/common';
import { SugerenciasIaModule } from '../sugerencias-ia/sugerencias-ia.module';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

@Module({ imports: [SugerenciasIaModule], controllers: [LotesController], providers: [LotesService] })
export class LotesModule {}
