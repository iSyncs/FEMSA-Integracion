import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { raw } from "express";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { pipeDeValidacion } from "./common/validacion/pipe";
import { FiltroDeErrores } from "./common/filtros/errores.filter";

/** Configuración compartida por el servidor y las pruebas e2e. */
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  // En Vercel la petición llega por un proxy: así req.ip es la IP real del usuario (bitácora y límite de intentos).
  if (process.env.VERCEL) (app as NestExpressApplication).set("trust proxy", 1);
  // Encabezados de seguridad; la API solo responde JSON, así que la política de contenido no aplica.
  app.use(helmet({ contentSecurityPolicy: false }));
  // Archivos de evidencia que pasan por la API: cuerpo binario de hasta 4 MB (límite de Vercel: 4.5 MB).
  app.use("/api/evidencias/cargas/archivo", raw({ type: "application/octet-stream", limit: "4mb" }));
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",") });
  app.useGlobalPipes(pipeDeValidacion);
  app.useGlobalFilters(new FiltroDeErrores());

  const doc = new DocumentBuilder()
    .setTitle("API · Sistema de Auditoría Interna FEMSA")
    .setDescription(
      "Equipo 2 · Ejecución, Cierre y Seguimiento. La sesión viaja en la cookie HttpOnly femsa_sesion que deja POST /api/sesion.",
    )
    .setVersion("3.0.0")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, doc));
  return app;
}
