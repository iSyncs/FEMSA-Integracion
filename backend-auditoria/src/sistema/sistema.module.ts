import { Module } from '@nestjs/common';
import { SistemaController } from './sistema.controller';

@Module({ controllers: [SistemaController] })
export class SistemaModule {}
