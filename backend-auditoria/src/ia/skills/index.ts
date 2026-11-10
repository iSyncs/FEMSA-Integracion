import { bloque, confianza, REGLAS, SEVERIDADES, Skill, texto } from './comun';

export interface Documento { nombre: string; contenido?: string }
export interface Contexto { auditoria?: string; unidad?: string; procedimientos?: string[] }

/** Clasificar documento: qué es y a qué procedimiento de la auditoría corresponde. */
export const clasificar: Skill<{ documento: Documento; contexto?: Contexto }> = {
  id: 'clasificar',
  maxTokens: 400,
  sistema: `${REGLAS}\nTu tarea: clasificar una evidencia recibida y sugerir a qué procedimiento de la auditoría corresponde.
El tipo describe el documento (por ejemplo Conciliación bancaria, Estado de cuenta, Política interna, Póliza contable), no el procedimiento.
El procedimiento se copia exactamente como aparece en la lista, sin numeración.`,
  mensaje: ({ documento, contexto }) => [
    bloque('auditoria', `${contexto?.auditoria ?? ''} ${contexto?.unidad ? `· ${contexto.unidad}` : ''}`),
    bloque('procedimientos', contexto?.procedimientos?.map((p) => `- ${p}`).join('\n')),
    bloque('documento', `Nombre: ${documento.nombre}\n${documento.contenido ?? ''}`),
    'Si ningún procedimiento aplica, deja procedimiento vacío.',
  ].join('\n\n'),
  esquema: {
    type: 'object', additionalProperties: false, required: ['tipo', 'procedimiento', 'confianza', 'motivo'],
    properties: {
      tipo: texto(3, 80, 'Tipo de documento, por ejemplo Conciliación bancaria, Política interna, Póliza contable'),
      procedimiento: texto(0, 200, 'Procedimiento sugerido tal como aparece en la lista, o vacío'),
      confianza,
      motivo: texto(5, 600, 'Por qué se clasificó así'),
    },
  },
};

/** Verificar completitud: qué falta en un lote según lo que pide el procedimiento (gatekeeper). */
export const completitud: Skill<{ requeridos: string[]; documentos: Documento[]; contexto?: Contexto }> = {
  id: 'completitud',
  maxTokens: 600,
  sistema: `${REGLAS}\nTu tarea: comparar los documentos recibidos contra los requeridos e identificar faltantes. Redacta un mensaje breve y cordial para el auditado pidiendo lo que falta.`,
  mensaje: ({ requeridos, documentos, contexto }) => [
    bloque('auditoria', contexto?.auditoria),
    bloque('requeridos', requeridos.map((r, i) => `${i + 1}. ${r}`).join('\n')),
    bloque('recibidos', documentos.map((d) => `- ${d.nombre}${d.contenido ? `: ${d.contenido.slice(0, 400)}` : ''}`).join('\n')),
  ].join('\n\n'),
  esquema: {
    type: 'object', additionalProperties: false, required: ['completo', 'faltantes', 'mensaje', 'confianza'],
    properties: {
      completo: { type: 'boolean' },
      faltantes: { type: 'array', maxItems: 20, items: texto(3, 200) },
      mensaje: texto(0, 800, 'Mensaje para el auditado; vacío si está completo'),
      confianza,
    },
  },
};

/** Sugerir hallazgo con la metodología condición, criterio, causa, efecto y recomendación. */
export const hallazgo: Skill<{ evidencias: Documento[]; contexto?: Contexto }> = {
  id: 'hallazgo',
  maxTokens: 1200,
  sistema: `${REGLAS}\nTu tarea: proponer UN hallazgo de auditoría con la metodología condición, criterio, causa, efecto y recomendación.
Severidad: Crítica si hay fraude, pérdida material o incumplimiento regulatorio grave; Alta si el control no opera; Moderada si opera con fallas; Baja si es de forma.
El impacto en MXN solo se llena si el monto aparece en la evidencia; si no, usa 0.`,
  mensaje: ({ evidencias, contexto }) => [
    bloque('auditoria', `${contexto?.auditoria ?? ''} ${contexto?.unidad ? `· ${contexto.unidad}` : ''}`),
    bloque('evidencias', evidencias.map((d) => `### ${d.nombre}\n${d.contenido ?? ''}`).join('\n\n')),
  ].join('\n\n'),
  esquema: {
    type: 'object', additionalProperties: false,
    required: ['titulo', 'condicion', 'criterio', 'causa', 'efecto', 'recomendacion', 'severidad', 'impacto_mxn', 'evidencia_citada', 'confianza'],
    properties: {
      titulo: texto(5, 160),
      condicion: texto(20, 1200, 'Qué se encontró'),
      criterio: texto(10, 800, 'Política, norma o control incumplido'),
      causa: texto(10, 800),
      efecto: texto(10, 800),
      recomendacion: texto(10, 800),
      severidad: { type: 'string', enum: SEVERIDADES },
      impacto_mxn: { type: 'number', minimum: 0, description: 'Monto en MXN tomado de la evidencia; 0 si no aparece' },
      evidencia_citada: texto(3, 300, 'Documento y sección en que se basa'),
      confianza,
    },
  },
};

/** Sugerir plan de remediación para un hallazgo ya registrado (HU_17). */
export const plan: Skill<{ hallazgo: { titulo: string; condicion?: string; causa?: string; recomendacion?: string; severidad?: string; impacto_mxn?: number | null } }> = {
  id: 'plan',
  maxTokens: 700,
  sistema: `${REGLAS}\nTu tarea: proponer un plan de remediación concreto y verificable para el hallazgo.
La descripción es una o dos oraciones sin listas; el detalle va en pasos.
Plazo sugerido: 30 días para Crítica, 60 para Alta, 90 para Moderada y 120 para Baja, salvo que la recomendación indique otro.`,
  mensaje: ({ hallazgo: h }) => bloque('hallazgo', [
    `Título: ${h.titulo}`, h.severidad && `Severidad: ${h.severidad}`, h.condicion && `Condición: ${h.condicion}`,
    h.causa && `Causa: ${h.causa}`, h.recomendacion && `Recomendación de auditoría: ${h.recomendacion}`,
    h.impacto_mxn != null && `Impacto: ${h.impacto_mxn} MXN`,
  ].filter(Boolean).join('\n')),
  esquema: {
    type: 'object', additionalProperties: false, required: ['descripcion', 'pasos', 'plazo_dias', 'evidencia_de_cierre', 'confianza'],
    properties: {
      descripcion: texto(10, 500, 'Descripción del plan en una o dos oraciones'),
      pasos: { type: 'array', maxItems: 8, items: texto(5, 200) },
      plazo_dias: { type: 'integer', minimum: 7, maximum: 365 },
      evidencia_de_cierre: texto(5, 300, 'Qué debe entregar el responsable para cerrar el plan'),
      confianza,
    },
  },
};

/** Resumen ejecutivo de los hallazgos de una auditoría. */
export const resumen: Skill<{ auditoria: string; hallazgos: { titulo: string; severidad: string; estado?: string; impacto_mxn?: number | null }[] }> = {
  id: 'resumen',
  maxTokens: 700,
  sistema: `${REGLAS}\nTu tarea: redactar un resumen ejecutivo breve para la Dirección de Auditoría.`,
  mensaje: ({ auditoria, hallazgos }) => [
    bloque('auditoria', auditoria),
    bloque('hallazgos', hallazgos.map((h) => `- [${h.severidad}] ${h.titulo}${h.estado ? ` (${h.estado})` : ''}${h.impacto_mxn != null ? ` · ${h.impacto_mxn} MXN` : ''}`).join('\n')),
  ].join('\n\n'),
  esquema: {
    type: 'object', additionalProperties: false, required: ['resumen', 'riesgos_principales', 'prioridad'],
    properties: {
      resumen: texto(20, 1200),
      riesgos_principales: { type: 'array', maxItems: 5, items: texto(5, 200) },
      prioridad: { type: 'string', enum: ['Inmediata', 'Alta', 'Normal'] },
    },
  },
};

export const SKILLS = { clasificar, completitud, hallazgo, plan, resumen };
export type IdSkill = keyof typeof SKILLS;
