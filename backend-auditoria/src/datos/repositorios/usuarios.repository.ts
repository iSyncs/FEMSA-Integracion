import type { Control, Riesgo, UnidadNegocio } from '../modelos';
import type { UsuarioSesion } from './vistas';

export abstract class UsuariosRepository {
  abstract listarActivos(): Promise<UsuarioSesion[]>;
  abstract buscarActivo(id: number): Promise<UsuarioSesion | null>;
  abstract credencial(correo: string): Promise<{ id: number; contrasena_hash: string | null } | null>;
}

export abstract class CatalogosRepository {
  abstract unidades(): Promise<UnidadNegocio[]>;
  abstract unidad(id: number): Promise<UnidadNegocio | null>;
  abstract controles(): Promise<(Control & { riesgo_folio: string; riesgo: string })[]>;
  abstract riesgos(): Promise<Riesgo[]>;
}
