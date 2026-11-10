import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { SesionGuard } from "./sesion.guard";
import { AccesoService } from "./acceso.service";
import { IdentificadorSesion, SesionesService } from "./sesiones.service";

@Global()
@Module({
  providers: [
    AccesoService,
    SesionesService,
    { provide: IdentificadorSesion, useExisting: SesionesService },
    { provide: APP_GUARD, useClass: SesionGuard },
  ],
  exports: [AccesoService, SesionesService],
})
export class AuthModule {}
