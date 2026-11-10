import { Global, Module } from "@nestjs/common";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";

// global, igual que la bitácora: planes, lotes y cierre avisan sin importar el módulo
@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
