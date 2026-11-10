// dias que cada registro se muestra en linea (despues pasa al almacen corporativo)
export const RETENCION_ACCESOS_DIAS = 30;
export const RETENCION_OPERACIONES_DIAS = 90;

const UN_DIA_MS = 86_400_000;

/** true si la fecha todavia esta dentro de los dias de retencion. */
export function dentroDeRetencion(fecha: Date, dias: number, ahora: Date = new Date()): boolean {
  return ahora.getTime() - fecha.getTime() <= dias * UN_DIA_MS;
}
