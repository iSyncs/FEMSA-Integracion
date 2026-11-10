import { Global, Module } from '@nestjs/common';
import { PbcController } from './pbc.controller';
import { PbcService } from './pbc.service';

// global: lotes marca la solicitud como enviada cuando llega la respuesta del área auditada
@Global()
@Module({ controllers: [PbcController], providers: [PbcService], exports: [PbcService] })
export class PbcModule {}
