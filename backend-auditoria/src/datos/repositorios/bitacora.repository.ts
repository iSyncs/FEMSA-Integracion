import type { Acceso, RegistroBitacora } from '../modelos';

export type NuevaOperacion = Omit<RegistroBitacora, 'id' | 'fecha'>;
export type NuevoAcceso = Omit<Acceso, 'id' | 'fecha'>;

export interface OperacionVista extends RegistroBitacora {
  usuario: string | null; rol: string | null; auditoria_id: number | null; auditoria_folio: string | null; auditoria: string | null;
}
export interface AccesoVista extends Acceso { usuario: string | null; rol: string | null }

/** FE1S-36 · Filtros que se resuelven en la base, no en memoria. `limiteFecha` aplica la retención. */
export interface FiltrosOperaciones {
  limiteFecha: Date; desde?: Date; hasta?: Date; usuarioId?: number; accion?: string; entidad?: string;
  auditoriaId?: number; texto?: string; inicio: number; limite: number;
}
export interface FiltrosAccesos {
  limiteFecha: Date; desde?: Date; hasta?: Date; usuarioId?: number; resultado?: string; texto?: string; inicio: number; limite: number;
}
export interface Pagina<T> { filas: T[]; total: number }

// solo se agregan registros, nunca se editan ni se borran
export abstract class BitacoraRepository {
  abstract agregarOperacion(datos: NuevaOperacion): Promise<RegistroBitacora>;
  abstract agregarAcceso(datos: NuevoAcceso): Promise<Acceso>;
  abstract operaciones(f: FiltrosOperaciones): Promise<Pagina<OperacionVista>>;
  abstract accesos(f: FiltrosAccesos): Promise<Pagina<AccesoVista>>;
}
