import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { IdentificadorSesion } from "../src/auth/sesiones.service";
import { IdentificadorDePrueba } from "./identificador-de-prueba";
import { configurarApp } from "../src/configurar-app";
import { IaCliente } from "../src/ia/ia.cliente";

const LIDER_RS = "1",
  DIRECTOR = "10",
  AUDITADO = "12";

/** FE1S-24 · Endpoints de IA con un proveedor simulado (no se llama a OpenRouter). */
describe("API de IA (e2e, proveedor simulado)", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const sugerenciaPlan = {
    descripcion: "Depurar partidas antiguas de la conciliación.",
    pasos: ["Revisar partidas"],
    plazo_dias: 60,
    evidencia_de_cierre: "Conciliación firmada",
    confianza: 80,
  };
  const fetchFn = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(sugerenciaPlan) } }] }),
      }) as unknown as Response,
  );

  beforeAll(async () => {
    const cliente = new IaCliente(
      { baseUrl: "https://openrouter.ai/api/v1", apiKey: "prueba", modelo: "modelo/prueba", timeoutMs: 1000 },
      fetchFn,
    );
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentificadorSesion)
      .useClass(IdentificadorDePrueba)
      .overrideProvider(IaCliente)
      .useValue(cliente)
      .compile();
    app = configurarApp(modulo.createNestApplication());
    await app.listen(0);
  });
  afterAll(() => app.close());

  it("el estado indica proveedor y modelo sin exponer la clave", async () => {
    const r = await api().get("/api/ia/estado").set("X-Usuario-Id", DIRECTOR).expect(200);
    expect(r.body).toEqual({ proveedor: "OpenRouter", modelo: "modelo/prueba", configurada: true });
  });

  it("sugiere un plan de remediación y no guarda nada", async () => {
    const r = await api()
      .post("/api/ia/plan")
      .set("X-Usuario-Id", LIDER_RS)
      .send({ hallazgo: { titulo: "Partidas sin depurar en conciliación", severidad: "Alta" } })
      .expect(200);
    expect(r.body).toMatchObject({ skill: "plan", sugerencia: sugerenciaPlan, modelo: "modelo/prueba" });
  });

  it("valida la entrada antes de llamar a la IA", async () => {
    const llamadas = fetchFn.mock.calls.length;
    await api().post("/api/ia/hallazgo").set("X-Usuario-Id", LIDER_RS).send({ evidencias: [] }).expect(422);
    await api()
      .post("/api/ia/hallazgo")
      .set("X-Usuario-Id", LIDER_RS)
      .send({ evidencias: [{ nombre: "x", contenido: "a".repeat(12_001) }] })
      .expect(422);
    expect(fetchFn.mock.calls.length).toBe(llamadas);
  });

  it("respeta los roles: el auditado no puede pedir hallazgos", () =>
    api()
      .post("/api/ia/hallazgo")
      .set("X-Usuario-Id", AUDITADO)
      .send({ evidencias: [{ nombre: "a.pdf", contenido: "texto" }] })
      .expect(403));

  it("sin sesión responde 401", () => api().get("/api/ia/estado").expect(401));
});
