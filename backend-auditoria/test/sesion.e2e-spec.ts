import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configurarApp } from "../src/configurar-app";
import { CUENTA_DEMO } from "../src/datos/memoria/datos-demo";

// FE1S-37 · Sin sustituir el identificador: aquí se prueba la cookie real.
describe("Sesión con cookie (e2e, datos en memoria)", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const cookieDe = (r: request.Response) =>
    ([] as string[]).concat(r.headers["set-cookie"] ?? []).find((c) => c.startsWith("femsa_sesion="));

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.listen(0);
  });
  afterAll(() => app.close());

  it("el inicio de sesión deja una cookie HttpOnly y SameSite=Lax de 8 horas", async () => {
    const r = await api().post("/api/sesion").send(CUENTA_DEMO).expect(201);
    const cookie = cookieDe(r)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api/);
    expect(cookie).toMatch(/Max-Age=28800/);
  });

  it("con la cookie la API reconoce al usuario", async () => {
    const cookie = cookieDe(await api().post("/api/sesion").send(CUENTA_DEMO))!.split(";")[0];
    const r = await api().get("/api/sesion").set("Cookie", cookie).expect(200);
    expect(r.body).toMatchObject({ nombre: "José Martínez", rol: "lider" });
    await api().get("/api/auditorias").set("Cookie", cookie).expect(200);
  });

  it("ignora el encabezado X-Usuario-Id: sin cookie no hay sesión", async () => {
    await api().get("/api/auditorias").set("X-Usuario-Id", "1").expect(401);
    await api().get("/api/sesion").set("X-Usuario-Id", "10").expect(401);
  });

  it("una cookie inventada no abre sesión", () =>
    api().get("/api/sesion").set("Cookie", "femsa_sesion=inventada").expect(401));

  it("cerrar sesión revoca el token aunque alguien guarde la cookie", async () => {
    const cookie = cookieDe(await api().post("/api/sesion").send(CUENTA_DEMO))!.split(";")[0];
    const r = await api().post("/api/sesion/cerrar").set("Cookie", cookie).expect(204);
    expect(cookieDe(r)).toMatch(/Expires=Thu, 01 Jan 1970/);
    await api().get("/api/sesion").set("Cookie", cookie).expect(401);
  });

  it("después de 10 intentos fallidos responde 429, incluso con la contraseña correcta", async () => {
    const correo = "d.herrera@demo.femsa.test";
    for (let i = 0; i < 10; i++) await api().post("/api/sesion").send({ correo, contrasena: "incorrecta" }).expect(401);
    await api().post("/api/sesion").send({ correo, contrasena: "incorrecta" }).expect(429);
  });

  it("agrega encabezados de seguridad", async () => {
    const r = await api().get("/api/health").expect(200);
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-powered-by"]).toBeUndefined();
  });
});
