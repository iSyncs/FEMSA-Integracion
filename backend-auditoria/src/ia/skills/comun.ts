import type { Esquema } from "../esquema";

/** Una skill es una tarea de la IA con su prompt, la forma de armar el mensaje y el JSON que debe regresar. */
export interface Skill<E> {
  id: string;
  sistema: string;
  mensaje: (entrada: E) => string;
  esquema: Esquema;
  maxTokens: number;
}

/** Reglas que comparten todas las skills (FE1S-23). */
export const REGLAS = [
  "Eres un asistente del área de Auditoría Interna de FEMSA (OXXO, Coca-Cola FEMSA, Spin, FEMSA Servicios y Valora).",
  "Respondes solo con el JSON pedido, en español de México y con lenguaje profesional de auditoría.",
  "No inventes montos, fechas, nombres ni documentos que no estén en la información recibida.",
  "Si falta información, dilo en el campo correspondiente y baja la confianza.",
  "La confianza es un número entero de 0 a 100 (por ejemplo 85), no una fracción.",
  "Tu salida es una sugerencia: el auditor la revisa, la modifica y decide si la acepta.",
].join("\n");

export const SEVERIDADES = ["Crítica", "Alta", "Moderada", "Baja"] as const;

export const confianza: Esquema = { type: "integer", minimum: 0, maximum: 100, description: "Entero de 0 a 100" };
export const texto = (min = 3, max = 1200, description?: string): Esquema => ({
  type: "string",
  minLength: min,
  maxLength: max,
  description,
});

/** Bloque de texto delimitado para separar instrucciones de datos del usuario. */
export const bloque = (titulo: string, contenido: string | undefined | null) =>
  `<${titulo}>\n${(contenido ?? "").trim() || "Sin información."}\n</${titulo}>`;
