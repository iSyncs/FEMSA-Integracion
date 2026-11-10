import { Module } from '@nestjs/common';
import { IaCliente } from './ia.cliente';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';

@Module({
  controllers: [IaController],
  providers: [IaService, { provide: IaCliente, useFactory: () => new IaCliente() }],
})
export class IaModule {}
