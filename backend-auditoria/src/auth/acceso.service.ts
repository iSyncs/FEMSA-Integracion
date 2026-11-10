import { ConflictException, Injectable } from '@nestjs/common';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import type { Direccion } from '../datos/modelos';
import type { AuditoriaVista, UsuarioSesion } from '../datos/repositorios/vistas';
import { noEncontrado } from '../common/errores';

/** Estados en los que una auditoría todavía acepta evidencia, solicitudes y análisis. */
export const ESTADOS_ABIERTOS = ['pendiente', 'en_ejecucion'];

interface ConAlcance { id?: number; auditoria_id?: number; unidad_negocio_id: number; direccion: Direccion }

/**
 * HU_01 · Seguridad por fila:
 *  - Director / Admin: todo.
 *  - Auditado: sólo auditorías donde participa.
 *  - GRC: su unidad de negocio.
 *  - Auditor / Líder / Jefe / Gerente: su Dirección (Bebidas vs Retail & Spin).
 */
@Injectable()
export class AccesoService {
  constructor(private readonly auditorias: AuditoriasRepository) {}

  async filtro(usuario: UsuarioSesion): Promise<(registro: ConAlcance) => boolean> {
    switch (usuario.rol) {
      case 'director':
      case 'admin':
        return () => true;
      case 'auditado': {
        const propias = new Set(await this.auditorias.auditoriasDeParticipante(usuario.id));
        return (r) => propias.has(r.auditoria_id ?? r.id ?? -1);
      }
      case 'grc':
        return (r) => r.unidad_negocio_id === usuario.unidad_negocio_id;
      default:
        return (r) => r.direccion === usuario.direccion;
    }
  }

  /** Auditoría visible para el usuario con su avance calculado; 404 si no existe o no le corresponde. */
  async auditoriaVisible(usuario: UsuarioSesion, id: number): Promise<AuditoriaVista & { avance: number }> {
    const a = await this.auditorias.buscar(id);
    if (!a || !(await this.filtro(usuario))(a)) throw noEncontrado('Auditoría');
    return conAvance(a);
  }

  /** Como `auditoriaVisible`, pero además exige que siga abierta; si ya no, responde 409 con `mensaje`. */
  async auditoriaAbierta(usuario: UsuarioSesion, id: number, mensaje = 'La auditoría ya no recibe evidencia.') {
    const auditoria = await this.auditoriaVisible(usuario, id);
    if (!ESTADOS_ABIERTOS.includes(auditoria.estado)) throw new ConflictException(mensaje);
    return auditoria;
  }
}

export const conAvance = <T extends AuditoriaVista>(a: T) => ({
  ...a, avance: a.procedimientos ? Math.round((a.supervisados / a.procedimientos) * 100) : 0,
});
