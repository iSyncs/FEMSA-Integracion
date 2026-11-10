import type {
  Aprobacion,
  Auditoria,
  Cierre,
  ClaveRol,
  Direccion,
  EstadoPlan,
  Evidencia,
  Hallazgo,
  Plan,
  Procedimiento,
  Severidad,
} from "../modelos";

export interface UsuarioSesion {
  id: number;
  nombre: string;
  correo: string;
  direccion: Direccion | null;
  unidad_negocio_id: number | null;
  zona_horaria: string;
  rol: ClaveRol;
  rol_nombre: string;
  unidad: string | null;
}

export interface AuditoriaVista extends Auditoria {
  unidad: string;
  direccion: Direccion;
  pais: string;
  zona_horaria: string;
  lider: string;
  procedimientos: number;
  supervisados: number;
  hallazgos_abiertos: number;
  hallazgos_criticos: number;
}

export interface ProcedimientoVista extends Procedimiento {
  control_folio: string;
  control: string;
  riesgo_folio: string;
  riesgo: string;
  auditor: string | null;
}

export interface HallazgoVista extends Hallazgo {
  auditoria_folio: string;
  auditoria: string;
  unidad: string;
  area: string;
  responsable: string | null;
  planes: number;
  unidad_negocio_id: number;
  direccion: Direccion;
  origen_ia: boolean;
}

export interface PlanVista extends Plan {
  responsable: string;
  hallazgo_folio: string;
  hallazgo: string;
  severidad: Severidad;
  auditoria_id: number;
  auditoria_folio: string;
  auditoria: string;
  unidad: string;
  zona_horaria: string;
  unidad_negocio_id: number;
  direccion: Direccion;
}

export interface EvidenciaVista extends Evidencia {
  cargado_por: string;
}

export interface AprobacionVista extends Aprobacion {
  aprobador: string | null;
}

export type CierreRegistro = Cierre;
export type { EstadoPlan };
