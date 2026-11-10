import 'reflect-metadata';
import './entorno';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';
import { usaSql } from './datos/datos.module';

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  const puerto = Number(process.env.PORT ?? 4000);
  await app.listen(puerto);
  new Logger('API').log(`http://localhost:${puerto}/api · documentación en /api/docs · datos: ${usaSql ? `SQL (${process.env.DB_NAME})` : 'en memoria'}`);
}
bootstrap();
