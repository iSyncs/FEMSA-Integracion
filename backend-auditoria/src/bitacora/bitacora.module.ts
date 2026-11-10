import { Global, Module } from '@nestjs/common';
import { BitacoraController } from './bitacora.controller';
import { BitacoraService } from './bitacora.service';

// global para que los demas modulos registren en la bitacora sin importarla
@Global()
@Module({ controllers: [BitacoraController], providers: [BitacoraService], exports: [BitacoraService] })
export class BitacoraModule {}
