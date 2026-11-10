import { BadGatewayException, Logger, ServiceUnavailableException } from "@nestjs/common";
import { paraProveedor, validar } from "./esquema";
import type { Skill } from "./skills/comun";

/**
 * FE1S-24 · Cliente de IA compatible con la API de OpenAI (chat/completions).
 * Sirve igual para OpenRouter (Sprint 2) y para LM Studio local: solo cambian las variables.
 *   IA_BASE_URL  https://openrouter.ai/api/v1 (por defecto) o http://localhost:1234/v1
 *   IA_API_KEY   clave de OpenRouter; LM Studio no la necesita
 *   IA_MODEL     id del modelo del proveedor
 *   IA_TIMEOUT_MS tiempo máximo por respuesta (60 s por defecto)
 */
export interface ConfigIa {
  baseUrl: string;
  apiKey: string | null;
  modelo: string | null;
  timeoutMs: number;
}

// Si no hay IA_*, se usan las variables OPENROUTER_* del módulo de sugerencias de IA (Jorge): una sola clave sirve para ambos.
export const leerConfig = (env: NodeJS.ProcessEnv = process.env): ConfigIa => ({
  baseUrl: (env.IA_BASE_URL || env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
  apiKey: env.IA_API_KEY || env.OPENROUTER_API_KEY || null,
  modelo: env.IA_MODEL || env.OPENROUTER_MODEL || null,
  timeoutMs:
    Number(env.IA_TIMEOUT_MS || env.OPENROUTER_TIMEOUT_MS) > 0
      ? Number(env.IA_TIMEOUT_MS || env.OPENROUTER_TIMEOUT_MS)
      : 60_000,
});

export const proveedor = (c: ConfigIa) =>
  c.baseUrl.includes("openrouter.ai")
    ? "OpenRouter"
    : /localhost|127\.0\.0\.1/.test(c.baseUrl)
      ? "LM Studio"
      : "Compatible con OpenAI";

/** Los modelos a veces envuelven el JSON en ```json … ```; se quita antes de leerlo. */
export function extraerJson(contenido: string): unknown {
  const limpio = contenido
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(limpio);
}

/** Se registra con una factory en IaModule (sus parámetros no son servicios de Nest). */
export class IaCliente {
  private readonly log = new Logger("IA");
  constructor(
    private readonly config: ConfigIa = leerConfig(),
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get configurada() {
    return !!this.config.modelo && (!!this.config.apiKey || proveedor(this.config) === "LM Studio");
  }

  descripcion() {
    return { proveedor: proveedor(this.config), modelo: this.config.modelo, configurada: this.configurada };
  }

  /** Ejecuta una skill y regresa su JSON validado. Si el JSON no cumple, reintenta una vez indicando los errores. */
  async ejecutar<E, S = unknown>(skill: Skill<E>, entrada: E): Promise<{ resultado: S; ms: number; modelo: string }> {
    if (!this.configurada) throw new ServiceUnavailableException("La IA no está configurada en este ambiente.");
    const inicio = Date.now();
    // El esquema va también en el prompt: hay modelos (p. ej. Nemotron free en OpenRouter) sin salida estructurada.
    const sistema = `${skill.sistema}\n\nResponde únicamente con un objeto JSON que cumpla este JSON Schema, sin texto adicional:\n${JSON.stringify(paraProveedor(skill.esquema))}`;
    const mensajes = [
      { role: "system", content: sistema },
      { role: "user", content: skill.mensaje(entrada) },
    ];

    for (let intento = 1; intento <= 2; intento++) {
      const contenido = await this.completar(skill, mensajes);
      let json: unknown;
      let errores: string[];
      try {
        json = extraerJson(contenido);
        errores = validar(json, skill.esquema);
      } catch {
        errores = ["La respuesta no es JSON válido."];
      }
      if (!errores.length) return { resultado: json as S, ms: Date.now() - inicio, modelo: this.config.modelo! };
      this.log.warn(`Skill ${skill.id}: respuesta inválida (intento ${intento}): ${errores.slice(0, 3).join("; ")}`);
      mensajes.push(
        { role: "assistant", content: contenido },
        {
          role: "user",
          content: `Corrige el JSON. Errores: ${errores.slice(0, 5).join("; ")}. Responde solo el JSON.`,
        },
      );
    }
    throw new BadGatewayException("La IA respondió en un formato no válido. Intenta de nuevo.");
  }

  private async completar(
    skill: Pick<Skill<never>, "id" | "maxTokens" | "esquema">,
    mensajes: { role: string; content: string }[],
  ): Promise<string> {
    const cuerpo = {
      model: this.config.modelo,
      messages: mensajes,
      temperature: 0.2,
      max_tokens: skill.maxTokens,
      reasoning_effort: "none",
      response_format: {
        type: "json_schema",
        json_schema: { name: skill.id, strict: true, schema: paraProveedor(skill.esquema) },
      },
    };
    let r: Response;
    try {
      r = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
          "X-Title": "FEMSA Auditoria Interna",
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (e) {
      this.log.error(`Sin respuesta del proveedor: ${(e as Error).message}`);
      throw new ServiceUnavailableException("La IA no está disponible en este momento.");
    }
    if (!r.ok) {
      this.log.error(`Proveedor respondió ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
      throw new ServiceUnavailableException(
        r.status === 429
          ? "La IA alcanzó su límite de uso. Intenta en un momento."
          : "La IA no está disponible en este momento.",
      );
    }
    // El tiempo límite también corre mientras llega el cuerpo; OpenRouter puede regresar un error dentro de un 200.
    let datos: { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };
    try {
      datos = (await r.json()) as typeof datos;
    } catch (e) {
      this.log.error(`Respuesta incompleta del proveedor: ${(e as Error).message}`);
      throw new ServiceUnavailableException("La IA no está disponible en este momento.");
    }
    if (datos.error) {
      this.log.error(`Proveedor respondió con error: ${datos.error.message ?? ""}`);
      throw new ServiceUnavailableException("La IA no está disponible en este momento.");
    }
    const contenido = datos.choices?.[0]?.message?.content;
    if (!contenido) throw new BadGatewayException("La IA no regresó contenido.");
    return contenido;
  }
}
