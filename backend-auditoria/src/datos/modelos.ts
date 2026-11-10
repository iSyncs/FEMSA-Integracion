export type Direccion = "Retail & Spin" | "Bebidas";
export type ClaveRol = "auditor" | "lider" | "jefe" | "gerente" | "director" | "grc" | "auditado" | "admin";
export type EstadoAuditoria = "pendiente" | "en_ejecucion" | "en_aprobacion" | "cerrada";
export type EstadoProcedimiento = "abierto" | "evaluado" | "revisado" | "supervisado" | "rechazado";
export type MadurezControl = "Inicial" | "Funcional" | "Definido" | "Administrado" | "Optimizado";
export type VulnerabilidadHistorica = "Bajo" | "Moderado" | "Alto";
export type Severidad = "Crítica" | "Alta" | "Moderada" | "Baja";
export type TipoHallazgo = "Debilidad de control" | "Debilidad menor";
export type EstadoHallazgo =
  | "abierto"
  | "revision_jefe"
  | "revision_gerente"
  | "esperando_plan"
  | "en_seguimiento"
  | "solventado"
  | "rechazado";
export type EstadoPlan =
  | "abierto"
  | "en_progreso"
  | "revision_grc"
  | "revision_jefe"
  | "reevaluando"
  | "cerrado"
  | "rechazado";
export type NivelAprobacion = "jefe" | "gerente" | "director";
export type Decision = "pendiente" | "aprobado" | "rechazado";
export type EstadoPbc = "solicitada" | "enviada" | "reenviar" | "completa";
export type EstadoPuntoPbc = "pendiente" | "cubierto" | "faltante";

export interface Rol {
  id: number;
  clave: ClaveRol;
  nombre: string;
  descripcion: string;
}

export interface UnidadNegocio {
  id: number;
  clave: string;
  unidad: string;
  direccion: Direccion;
  division: string;
  area: string;
  pais: string;
  zona_horaria: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol_id: number;
  direccion: Direccion | null;
  unidad_negocio_id: number | null;
  zona_horaria: string;
  activo: boolean;
  contrasena_hash: string | null;
}

export interface Auditoria {
  id: number;
  tracking_id: string;
  nombre: string;
  objetivo: string | null;
  unidad_negocio_id: number;
  tipo: string | null;
  area: string | null;
  prioridad: "Alta" | "Media" | "Baja";
  lider_id: number;
  estado: EstadoAuditoria;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  creado_en: Date;
}

export interface Participante {
  auditoria_id: number;
  usuario_id: number;
  papel: string;
}

export interface Riesgo {
  id: number;
  tracking_id: string;
  nombre: string;
  categoria: string;
  nivel_inherente: string;
}

export interface Control {
  id: number;
  tracking_id: string;
  nombre: string;
  dominio: string;
  riesgo_id: number;
}

export interface Procedimiento {
  id: number;
  tracking_id: string;
  auditoria_id: number;
  control_id: number;
  auditor_id: number | null;
  estado: EstadoProcedimiento;
  calif_diseno: string | null;
  calif_efectividad: string | null;
  vulnerabilidad: string | null;
  aplica_hallazgo: boolean;
  comentarios: string | null;
  fecha_evaluacion: Date | null;
}

export interface EvaluacionProcedimiento {
  calif_diseno: MadurezControl;
  calif_efectividad: MadurezControl;
  vulnerabilidad: VulnerabilidadHistorica;
  comentarios: string | null;
}

export interface Hallazgo {
  id: number;
  tracking_id: string;
  auditoria_id: number;
  procedimiento_id: number | null;
  titulo: string;
  condicion: string;
  criterio: string;
  causa: string;
  efecto: string;
  recomendacion: string;
  severidad: Severidad;
  tipo: TipoHallazgo;
  riesgo_residual: string | null;
  impacto_mxn: number | null;
  estado: EstadoHallazgo;
  responsable_id: number | null;
  fecha_identificacion: Date;
}

/** HU_05 · Solicitud de información (dbo.REQUEST_PBC) y sus puntos (dbo.REQUEST_PBC_ITEM). */
export interface SolicitudPbcRegistro {
  id: number;
  tracking_id: string;
  procedimiento_id: number;
  estado: EstadoPbc;
  asunto: string | null;
  solicitado_por_id: number | null;
  solicitado_a_id: number | null;
  fecha_limite: Date | null;
  creado: Date;
  enviado: Date | null;
  cerrado: Date | null;
  comentario_revision: string | null;
}

export interface PuntoPbc {
  id: number;
  solicitud_id: number;
  descripcion: string;
  obligatorio: boolean;
  estado: EstadoPuntoPbc;
  orden: number;
}

export interface Evidencia {
  id: number;
  tracking_id: string;
  evidencia_padre_id: number | null;
  procedimiento_id: number | null;
  solicitud_pbc_id: number | null;
  hallazgo_id: number | null;
  nombre_archivo: string;
  blob_url: string | null;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  hash_sha256: string | null;
  cargado_por_id: number;
  fecha_carga: Date;
  eliminado: boolean;
}

export interface Aprobacion {
  id: number;
  auditoria_id: number;
  secuencia: number;
  nivel: NivelAprobacion;
  aprobador_id: number | null;
  decision: Decision;
  comentarios: string | null;
  fecha_decision: Date | null;
  zona_horaria: string | null;
}

export interface Cierre {
  id: number;
  auditoria_id: number;
  cerrado_por_id: number;
  sello_temporal: Date;
  algoritmo: "SHA-256";
  hash_integridad: string;
  manifiesto: string;
  firma: string | null;
}

export interface Plan {
  id: number;
  tracking_id: string;
  hallazgo_id: number;
  descripcion: string;
  responsable_id: number;
  fecha_compromiso: Date;
  monto_mxn: number | null;
  estado: EstadoPlan;
  avance_pct: number;
  fecha_conclusion: Date | null;
}

export interface Avance {
  id: number;
  plan_id: number;
  avance_pct: number;
  comentario: string;
  evidencia_id: number | null;
  actualizado_por_id: number;
  fecha: Date;
  zona_horaria: string | null;
}

export interface Notificacion {
  id: number;
  usuario_id: number;
  plan_id: number | null;
  auditoria_id: number | null;
  tipo: string;
  mensaje: string | null;
  canal: "plataforma" | "correo";
  fecha_programada: Date | null;
  fecha_envio: Date | null;
  leida: boolean;
}

export interface RegistroBitacora {
  id: number;
  entidad: string;
  entidad_id: number | null;
  folio: string | null;
  accion: string;
  usuario_id: number | null;
  detalle: string | null;
  ip: string | null;
  zona_horaria: string | null;
  fecha: Date;
}

export interface Acceso {
  id: number;
  usuario_id: number | null;
  correo: string | null;
  resultado: "exito" | "fallo" | "denegado" | "cierre_sesion";
  ip: string | null;
  agente: string | null;
  zona_horaria: string | null;
  fecha: Date;
}
