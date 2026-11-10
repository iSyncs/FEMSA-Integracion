import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Respuesta de error uniforme: { error, detalles? } */
@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  private readonly log = new Logger('API');

  catch(excepcion: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (excepcion instanceof HttpException) {
      const cuerpo = excepcion.getResponse();
      const status = excepcion.getStatus();
      if (typeof cuerpo === 'object' && cuerpo && 'error' in cuerpo && 'detalles' in cuerpo) {
        return res.status(status).json(cuerpo);
      }
      const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: string | string[] }).message ?? excepcion.message;
      const detalles = typeof cuerpo === 'object' && cuerpo ? (cuerpo as { detalles?: unknown }).detalles : undefined;
      return res.status(status).json({ error: status === 404 && !detalles && /Cannot/.test(String(mensaje)) ? 'Ruta no encontrada.' : mensaje, detalles });
    }
    this.log.error(excepcion);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Error interno del servidor.' });
  }
}
