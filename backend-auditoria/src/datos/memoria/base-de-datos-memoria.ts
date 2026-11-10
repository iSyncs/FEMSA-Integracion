import { Injectable } from '@nestjs/common';
import {
  Acceso, Aprobacion, Auditoria, Avance, Cierre, Control, Evidencia, Hallazgo, Notificacion, Participante, Plan,
  Procedimiento, PuntoPbc, RegistroBitacora, Riesgo, Rol, SolicitudPbcRegistro, UnidadNegocio, Usuario,
} from '../modelos';
import { sembrarDatosDemo } from './datos-demo';

const PREFIJOS = { aud: 'AUD', ap: 'AP', fnd: 'FND', rp: 'RP', soporte: 'SOPORTE', pbc: 'PBC' } as const;
type Secuencia = keyof typeof PREFIJOS;

@Injectable()
export class BaseDeDatosMemoria {
  roles: Rol[] = [];
  unidades: UnidadNegocio[] = [];
  usuarios: Usuario[] = [];
  auditorias: Auditoria[] = [];
  participantes: Participante[] = [];
  riesgos: Riesgo[] = [];
  controles: Control[] = [];
  procedimientos: Procedimiento[] = [];
  hallazgos: Hallazgo[] = [];
  evidencias: Evidencia[] = [];
  aprobaciones: Aprobacion[] = [];
  cierres: Cierre[] = [];
  planes: Plan[] = [];
  avances: Avance[] = [];
  notificaciones: Notificacion[] = [];
  solicitudesPbc: SolicitudPbcRegistro[] = [];
  puntosPbc: PuntoPbc[] = [];
  bitacora: RegistroBitacora[] = [];
  accesos: Acceso[] = [];

  private ids = new Map<string, number>();
  private secuencias = new Map<Secuencia, number>();

  constructor() {
    this.reiniciar();
  }

  reiniciar(): void {
    for (const k of Object.keys(this) as (keyof this)[]) {
      if (Array.isArray(this[k])) (this[k] as unknown[]) = [];
    }
    this.ids.clear();
    this.secuencias.clear();
    sembrarDatosDemo(this);
  }

  siguienteId(tabla: string): number {
    const n = (this.ids.get(tabla) ?? 0) + 1;
    this.ids.set(tabla, n);
    return n;
  }

  siguienteFolio(secuencia: Secuencia): string {
    const n = (this.secuencias.get(secuencia) ?? 0) + 1;
    this.secuencias.set(secuencia, n);
    return `${PREFIJOS[secuencia]}-${String(n).padStart(6, '0')}`;
  }

  get colecciones(): number {
    return Object.values(this).filter(Array.isArray).length;
  }
}
