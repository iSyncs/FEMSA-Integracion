import { Module } from "@nestjs/common";
import { DatosModule } from "./datos/datos.module";
import { AuthModule } from "./auth/auth.module";
import { SistemaModule } from "./sistema/sistema.module";
import { AuditoriasModule } from "./auditorias/auditorias.module";
import { CierreModule } from "./cierre/cierre.module";
import { HallazgosModule } from "./hallazgos/hallazgos.module";
import { PlanesModule } from "./planes/planes.module";
import { ReportesModule } from "./reportes/reportes.module";
import { BitacoraModule } from "./bitacora/bitacora.module";
import { EvidenciasModule } from "./evidencias/evidencias.module";
import { IaModule } from "./ia/ia.module";
import { SugerenciasIaModule } from "./sugerencias-ia/sugerencias-ia.module";
import { LotesModule } from "./lotes/lotes.module";
import { NotificacionesModule } from "./notificaciones/notificaciones.module";
import { PbcModule } from "./pbc/pbc.module";

/**
 * Un módulo por dominio. Para agregar una historia nueva (p. ej. HU_05 Solicitudes PBC):
 * crear src/pbc/{pbc.module,pbc.controller,pbc.service,pbc.dto}.ts, su repositorio en src/datos
 * y registrar el módulo aquí. Ver backend/README.md.
 */
@Module({
  imports: [
    DatosModule,
    AuthModule,
    SistemaModule,
    AuditoriasModule,
    CierreModule,
    HallazgosModule,
    PlanesModule,
    ReportesModule,
    BitacoraModule,
    EvidenciasModule,
    IaModule,
    SugerenciasIaModule,
    LotesModule,
    NotificacionesModule,
    PbcModule,
  ],
})
export class AppModule {}
