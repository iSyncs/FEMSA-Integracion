import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { extraerJson, IaCliente, leerConfig, proveedor } from './ia.cliente';
import { SKILLS } from './skills';

const config = { baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'prueba', modelo: 'modelo/prueba', timeoutMs: 1000 };
const respuesta = (contenido: string, status = 200) =>
  ({ ok: status < 400, status, json: async () => ({ choices: [{ message: { content: contenido } }] }), text: async () => contenido }) as Response;
const plan = { descripcion: 'Depurar partidas antiguas de la conciliación.', pasos: ['Revisar partidas', 'Autorizar ajustes'], plazo_dias: 60, evidencia_de_cierre: 'Conciliación firmada', confianza: 80 };
const entrada = { hallazgo: { titulo: 'Partidas sin depurar', severidad: 'Alta' } };

describe('cliente de IA compatible con OpenAI (FE1S-24)', () => {
  it('lee la configuración con OpenRouter por defecto y detecta el proveedor', () => {
    expect(leerConfig({}).baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(proveedor(leerConfig({ IA_BASE_URL: 'http://localhost:1234/v1/' }))).toBe('LM Studio');
    expect(new IaCliente(leerConfig({ IA_BASE_URL: 'http://localhost:1234/v1', IA_MODEL: 'qwen' })).configurada).toBe(true);
    expect(new IaCliente(leerConfig({ IA_MODEL: 'x' })).configurada).toBe(false); // OpenRouter sin clave
    // Comparte las variables del módulo de sugerencias de IA cuando no hay IA_*.
    expect(leerConfig({ OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' })).toMatchObject({ apiKey: 'k', modelo: 'm' });
    expect(leerConfig({ IA_MODEL: 'propio', OPENROUTER_MODEL: 'compartido' }).modelo).toBe('propio');
  });

  it('extrae JSON aunque venga envuelto en un bloque de código', () => {
    expect(extraerJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('manda el esquema, sin razonamiento extendido, y regresa la sugerencia validada', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(JSON.stringify(plan)));
    const r = await new IaCliente(config, fetchFn).ejecutar(SKILLS.plan, entrada);
    expect(r.resultado).toEqual(plan);
    const [url, init] = fetchFn.mock.calls[0];
    const cuerpo = JSON.parse(init.body);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer prueba');
    expect(cuerpo).toMatchObject({ model: 'modelo/prueba', reasoning_effort: 'none', response_format: { type: 'json_schema', json_schema: { name: 'plan', strict: true } } });
    expect(cuerpo.messages[1].content).toContain('Partidas sin depurar');
  });

  it('reintenta una vez si el JSON no cumple el esquema', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(respuesta(JSON.stringify({ ...plan, plazo_dias: 2 })))
      .mockResolvedValueOnce(respuesta(JSON.stringify(plan)));
    const r = await new IaCliente(config, fetchFn).ejecutar(SKILLS.plan, entrada);
    expect(r.resultado).toEqual(plan);
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).messages.at(-1).content).toContain('plazo_dias');
  });

  it('responde 502 si tras el reintento sigue sin ser válido', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta('no es json'));
    await expect(new IaCliente(config, fetchFn).ejecutar(SKILLS.plan, entrada)).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('responde 503 si el proveedor no contesta, falla o no está configurado', async () => {
    await expect(new IaCliente(config, jest.fn().mockRejectedValue(new Error('timeout'))).ejecutar(SKILLS.plan, entrada)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(new IaCliente(config, jest.fn().mockResolvedValue(respuesta('x', 429))).ejecutar(SKILLS.plan, entrada)).rejects.toThrow('límite de uso');
    await expect(new IaCliente({ ...config, modelo: null }, jest.fn()).ejecutar(SKILLS.plan, entrada)).rejects.toBeInstanceOf(ServiceUnavailableException);
    const cuerpoCortado = { ok: true, status: 200, json: async () => { throw new DOMException('timeout', 'TimeoutError'); } } as unknown as Response;
    await expect(new IaCliente(config, jest.fn().mockResolvedValue(cuerpoCortado)).ejecutar(SKILLS.plan, entrada)).rejects.toBeInstanceOf(ServiceUnavailableException);
    const errorEn200 = { ok: true, status: 200, json: async () => ({ error: { message: 'Provider returned error' } }) } as unknown as Response;
    await expect(new IaCliente(config, jest.fn().mockResolvedValue(errorEn200)).ejecutar(SKILLS.plan, entrada)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
