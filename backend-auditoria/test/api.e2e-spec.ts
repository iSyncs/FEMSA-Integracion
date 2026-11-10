import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { IdentificadorSesion } from "../src/auth/sesiones.service";
import { IdentificadorDePrueba } from "./identificador-de-prueba";
import { configurarApp } from "../src/configurar-app";
import { BaseDeDatosMemoria } from "../src/datos/memoria/base-de-datos-memoria";
import { CUENTA_DEMO } from "../src/datos/memoria/datos-demo";
import { BlobStorageService } from "../src/evidencias/blob-storage.service";
import { SelladoService } from "../src/cierre/sellado.service";
import { OpenRouterService } from "../src/sugerencias-ia/openrouter.service";

const LIDER_RS = "1",
  GERENTE_RS = "8",
  DIRECTOR = "10",
  AUDITADO = "12";

describe("API de Auditoría (e2e, datos en memoria)", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const blob = {
    contenido: Buffer.from("%PDF-1.7\nevidencia de prueba"),
    autorizarCarga: jest.fn(async () => "https://blob.example/carga?sas=write"),
    descargar: jest.fn(async function () {
      return {
        buffer: this.contenido,
        tamano: this.contenido.length,
        etiquetas: { "Malware scanning scan result": "No threats found" },
      };
    }),
    resultadoAntivirus: jest.fn(() => "No threats found"),
    autorizarLectura: jest.fn(async () => "https://blob.example/lectura?sas=read"),
    borrarCargaRechazada: jest.fn(async () => undefined),
    subir: jest.fn(async () => undefined),
  };
  const borradorIa = (titulo: string) => ({
    titulo,
    condicion: "En la muestra revisada se identificó una excepción documentada que requiere atención.",
    criterio: "El lineamiento aplicable exige evidencia completa y revisión independiente.",
    causa: "El proceso permite completar la actividad sin validar todos los requisitos.",
    efecto: "Existe riesgo de errores no detectados y seguimiento insuficiente.",
    recomendacion: "Configurar una validación obligatoria y monitorear las excepciones.",
    severidad: "Alta",
    tipo: "Debilidad de control",
    impactoMxn: 100000,
    evidencia: "documento.txt · línea 1",
    confianza: 1,
  });
  const openRouter = {
    analizar: jest.fn(async () => ({
      resumen: "El acta documenta un arqueo de caja con una diferencia pendiente de aclaración.",
      puntosClave: ["Se identificó una diferencia de efectivo.", "El documento sólo contiene una firma."],
      verificaciones: [
        { aspecto: "Fecha del arqueo", estado: "Presente", detalle: "La fecha está indicada en el encabezado." },
        { aspecto: "Firmas y autorizaciones", estado: "Presente", detalle: "Firma del supervisor pendiente." },
      ],
      documentos: [{ nombre: "documento.txt", tipo: "Acta de control", confianza: 1 }],
      faltantes: [{ texto: "Falta la segunda firma requerida", referencia: "Requisito 1", criticidad: "Alta" }],
      borradores: [borradorIa("Control sin segunda validación"), borradorIa("Seguimiento incompleto de excepciones")],
    })),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentificadorSesion)
      .useClass(IdentificadorDePrueba)
      .overrideProvider(BlobStorageService)
      .useValue(blob)
      .overrideProvider(OpenRouterService)
      .useValue(openRouter)
      .compile();
    app = configurarApp(modulo.createNestApplication());
    await app.listen(0);
  });
  afterAll(() => app.close());

  it("health responde sin sesión", async () => {
    const r = await api().get("/api/health").expect(200);
    expect(r.body).toMatchObject({ ok: true, motor: "Datos en memoria" });
  });

  it("HU_01: sin sesión responde 401", () => api().get("/api/auditorias").expect(401));

  it("HU_01: la lista de usuarios ya no es pública", () => api().get("/api/usuarios").expect(401));

  it("HU_01: ya no existe el acceso rápido sin contraseña", () =>
    api().post("/api/sesion/demo").send({ rol: "lider" }).expect(404));

  it("HU_01: inicia sesión con correo y contraseña", async () => {
    const r = await api().post("/api/sesion").send(CUENTA_DEMO).expect(201);
    expect(r.body).toMatchObject({ nombre: "José Martínez", rol: "lider", correo: CUENTA_DEMO.correo });
    expect(r.body).not.toHaveProperty("contrasena_hash");
  });

  it("HU_01: inicio de sesión valida el formato del correo", () =>
    api().post("/api/sesion").send({ correo: "no-es-correo", contrasena: "x" }).expect(422));

  it("HU_01: el auditado sólo ve las auditorías donde participa", async () => {
    const r = await api().get("/api/auditorias").set("X-Usuario-Id", AUDITADO).expect(200);
    expect(r.body.map((a: { tracking_id: string }) => a.tracking_id).sort()).toEqual([
      "AUD-000002",
      "AUD-000004",
      "AUD-000009",
    ]);
  });

  it("HU_01: un líder de Retail & Spin no ve auditorías de Bebidas", async () => {
    const r = await api().get("/api/auditorias").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(r.body.every((a: { direccion: string }) => a.direccion === "Retail & Spin")).toBe(true);
  });

  it("HU_04: rechaza hallazgos con texto de relleno, campo por campo", async () => {
    const r = await api()
      .post("/api/hallazgos")
      .set("X-Usuario-Id", LIDER_RS)
      .send({
        auditoriaId: 2,
        titulo: "  ",
        condicion: "n/a",
        criterio: "x",
        causa: "asdf",
        efecto: "....",
        recomendacion: " ",
        severidad: "Alta",
        tipo: "Debilidad menor",
      })
      .expect(422);
    expect(Object.keys(r.body.detalles).sort()).toEqual([
      "causa",
      "condicion",
      "criterio",
      "efecto",
      "recomendacion",
      "titulo",
    ]);
  });

  it("HU_04: registra un hallazgo válido con folio FND", async () => {
    const r = await api()
      .post("/api/hallazgos")
      .set("X-Usuario-Id", LIDER_RS)
      .send({
        auditoriaId: 2,
        procedimientoId: 4,
        titulo: "Pagos liberados sin segunda firma",
        condicion: "En la muestra de 40 pagos, 6 fueron liberados por el mismo usuario.",
        criterio: "Política de tesorería de firma dual",
        causa: "El ERP permite omitir la segunda firma",
        efecto: "Riesgo de pagos no autorizados",
        recomendacion: "Bloquear la omisión de firma dual",
        severidad: "Alta",
        tipo: "Debilidad de control",
      })
      .expect(201);
    expect(r.body.tracking_id).toMatch(/^FND-\d{6}$/);
  });

  it("IA: muestra los tres bloques y permite aceptar o descartar sugerencias", async () => {
    const vacia = await api().get("/api/ia/sugerencias").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(vacia.body).toMatchObject({
      documentos: [],
      faltantes: [],
      borradores: [],
      criterios: expect.any(Array),
      resumen: { documentos: 0, faltantes: 0, pendientes: 0 },
    });
    expect(vacia.body.criterios.length).toBeGreaterThanOrEqual(8);
    const auditoria = await api().get("/api/auditorias/8").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(auditoria.body.evidencias.map((e: { nombre_archivo: string }) => e.nombre_archivo)).toEqual(
      expect.arrayContaining(["acta_arqueo_completa_1842.pdf", "acta_arqueo_parcial_1842.pdf"]),
    );
    const evidencia = auditoria.body.evidencias.find(
      (e: { nombre_archivo: string }) => e.nombre_archivo === "acta_arqueo_tienda_1842.pdf",
    );
    expect(evidencia).toMatchObject({ id: expect.any(Number), tipo_mime: "application/pdf" });
    await api()
      .post("/api/ia/sugerencias/analizar")
      .set("X-Usuario-Id", LIDER_RS)
      .send({
        auditoriaId: 8,
        evidenciaId: evidencia.id,
      })
      .expect(201);
    // Ahorro de tokens: volver a analizar la misma evidencia no llama otra vez a la IA ni duplica sugerencias.
    const repetido = await api()
      .post("/api/ia/sugerencias/analizar")
      .set("X-Usuario-Id", LIDER_RS)
      .send({
        auditoriaId: 8,
        evidenciaId: evidencia.id,
      })
      .expect(201);
    expect(repetido.body.enCache).toBe(true);
    const lista = await api().get("/api/ia/sugerencias").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(lista.body).toMatchObject({
      documentos: expect.any(Array),
      faltantes: expect.any(Array),
      borradores: expect.any(Array),
      resumen: { documentos: expect.any(Number), faltantes: expect.any(Number), pendientes: expect.any(Number) },
    });
    expect(lista.body.borradores.length).toBeGreaterThanOrEqual(2);
    expect(lista.body.documentos[0]).toMatchObject({
      resumen: expect.any(String),
      puntosClave: expect.any(Array),
      verificaciones: expect.any(Array),
    });
    expect(lista.body.documentos[0].confianza).toBe(100);
    expect(lista.body.borradores[0].confianza).toBe(100);
    expect(lista.body.documentos[0].verificaciones).toContainEqual(
      expect.objectContaining({ aspecto: "Firmas y autorizaciones", estado: "Faltante" }),
    );
    expect(lista.body.faltantes[0]).toMatchObject({
      auditoria: "AUD-000008",
      documentoId: expect.any(Number),
      documento: expect.any(String),
    });
    expect(openRouter.analizar).toHaveBeenCalledTimes(1);

    const [aceptada, descartada] = lista.body.borradores;
    await api().post(`/api/ia/sugerencias/${aceptada.id}/aceptar`).set("X-Usuario-Id", AUDITADO).expect(403);
    await api()
      .post(`/api/ia/sugerencias/${descartada.id}/descartar`)
      .set("X-Usuario-Id", LIDER_RS)
      .send({ motivo: "n/a" })
      .expect(422);
    const hallazgo = await api()
      .post(`/api/ia/sugerencias/${aceptada.id}/aceptar`)
      .set("X-Usuario-Id", LIDER_RS)
      .expect(201);
    expect(hallazgo.body).toMatchObject({
      tracking_id: expect.stringMatching(/^FND-\d{6}$/),
      estadoSugerencia: "aceptada",
    });
    const hallazgosIa = await api().get("/api/hallazgos").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(hallazgosIa.body).toContainEqual(
      expect.objectContaining({ tracking_id: hallazgo.body.tracking_id, origen_ia: true }),
    );

    await api()
      .post(`/api/ia/sugerencias/${descartada.id}/descartar`)
      .set("X-Usuario-Id", LIDER_RS)
      .send({ motivo: "La evidencia debe ampliarse antes de formalizar un hallazgo." })
      .expect(201);
    await api()
      .post(`/api/ia/sugerencias/${descartada.id}/descartar`)
      .set("X-Usuario-Id", LIDER_RS)
      .send({ motivo: "Segundo intento no permitido." })
      .expect(409);
  });

  it("Lotes: al llegar un lote la IA lo analiza sola y el auditor ve el resultado", async () => {
    const antes = openRouter.analizar.mock.calls.length;
    const lote = await api()
      .post("/api/lotes/simular")
      .set("X-Usuario-Id", LIDER_RS)
      .send({ auditoriaId: 8 })
      .expect(201);
    expect(lote.body).toMatchObject({
      tracking_id: expect.stringMatching(/^LOT-\d{6}$/),
      auditoria_folio: "AUD-000008",
      total: expect.any(Number),
    });
    let detalle = await api().get(`/api/lotes/${lote.body.id}`).set("X-Usuario-Id", LIDER_RS).expect(200);
    for (let i = 0; i < 50 && ["pendiente", "analizando"].includes(detalle.body.estado); i++) {
      await new Promise((r) => setTimeout(r, 20));
      detalle = await api().get(`/api/lotes/${lote.body.id}`).set("X-Usuario-Id", LIDER_RS).expect(200);
    }
    expect(detalle.body).toMatchObject({ estado: "listo", analizados: lote.body.total });
    expect(detalle.body.resultados).toHaveLength(lote.body.total);
    expect(detalle.body.resultados.every((r: { analizado: boolean }) => r.analizado)).toBe(true);
    expect(openRouter.analizar.mock.calls.length).toBeGreaterThan(antes);
    const bandeja = await api().get("/api/lotes").set("X-Usuario-Id", LIDER_RS).expect(200);
    expect(bandeja.body[0]).toMatchObject({ id: lote.body.id, estado: "listo", documentos: lote.body.total });
    // Una evidencia sólo puede llegar en un lote.
    await api()
      .post("/api/lotes")
      .set("X-Usuario-Id", LIDER_RS)
      .send({ auditoriaId: 8, evidencias: [detalle.body.documentos[0].id] })
      .expect(409);
    // El auditado no ve lotes de otros ni puede pedir el respaldo del demo.
    await api().post("/api/lotes/simular").set("X-Usuario-Id", AUDITADO).send({ auditoriaId: 8 }).expect(403);
    const ajena = await api().get("/api/lotes").set("X-Usuario-Id", AUDITADO).expect(200);
    expect(ajena.body.find((l: { id: number }) => l.id === lote.body.id)).toBeUndefined();
  });

  it("CP-003: guarda la evaluación, calcula 70% y registra trazabilidad", async () => {
    const r = await api()
      .post("/api/auditorias/1/procedimientos/3/evaluacion")
      .set("X-Usuario-Id", "2")
      .set("X-Zona-Horaria", "America/Mexico_City")
      .send({ diseno: "Definido", efectividad: "Optimizado", vulnerabilidad: "Bajo" })
      .expect(201);
    expect(r.body).toMatchObject({
      estado: "evaluado",
      calif_diseno: "Definido",
      calif_efectividad: "Optimizado",
      vulnerabilidad: "Bajo",
      avance: 70,
    });

    const bitacora = await api().get("/api/bitacora").set("X-Usuario-Id", GERENTE_RS).expect(200);
    expect(bitacora.body.operaciones[0]).toMatchObject({
      folio: "AP-000003",
      accion: "EVALUAR",
      usuario_id: 2,
      zona_horaria: "America/Mexico_City",
    });
    expect(new Date(bitacora.body.operaciones[0].fecha).toISOString()).toBeTruthy();
  });

  it("CP-004: exige justificación real para efectividad Inicial o Funcional", async () => {
    await api()
      .post("/api/auditorias/1/procedimientos/3/evaluacion")
      .set("X-Usuario-Id", "2")
      .send({ diseno: "Funcional", efectividad: "Inicial", vulnerabilidad: "Alto", comentarios: "n/a" })
      .expect(422);
    await api()
      .post("/api/auditorias/1/procedimientos/3/evaluacion")
      .set("X-Usuario-Id", "2")
      .send({
        diseno: "Funcional",
        efectividad: "Funcional",
        vulnerabilidad: "Alto",
        comentarios: "Causa técnica documentada y pendiente de remediación.",
      })
      .expect(201);
  });

  it("CP-005 / HU_03: autoriza Blob, confirma hash, consulta SAS y borra lógicamente", async () => {
    const inicio = await api()
      .post("/api/evidencias/cargas")
      .set("X-Usuario-Id", LIDER_RS)
      .send({
        auditoriaId: 2,
        procedimientoId: 4,
        nombreArchivo: "papel_trabajo.pdf",
        tipoMime: "application/pdf",
        tamanoBytes: blob.contenido.length,
      })
      .expect(201);
    expect(inicio.body).toMatchObject({
      uploadUrl: expect.stringContaining("sas=write"),
      token: expect.any(String),
      expiraEnSegundos: 600,
    });
    // El navegador también puede mandar el archivo a la API, que lo escribe en el blob autorizado.
    await api()
      .post("/api/evidencias/cargas/archivo")
      .set("X-Usuario-Id", LIDER_RS)
      .set("X-Token-Carga", inicio.body.token)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("otro tamaño"))
      .expect(400);
    await api()
      .post("/api/evidencias/cargas/archivo")
      .set("X-Usuario-Id", GERENTE_RS)
      .set("X-Token-Carga", inicio.body.token)
      .set("Content-Type", "application/octet-stream")
      .send(blob.contenido)
      .expect(403);
    await api()
      .post("/api/evidencias/cargas/archivo")
      .set("X-Usuario-Id", LIDER_RS)
      .set("X-Token-Carga", inicio.body.token)
      .set("Content-Type", "application/octet-stream")
      .send(blob.contenido)
      .expect(201);
    expect(blob.subir).toHaveBeenCalledWith(expect.any(String), blob.contenido);
    const confirmada = await api()
      .post("/api/evidencias/cargas/confirmar")
      .set("X-Usuario-Id", LIDER_RS)
      .send({ token: inicio.body.token })
      .expect(201);
    expect(confirmada.body).toMatchObject({
      tracking_id: expect.stringMatching(/^SOPORTE-\d{6}$/),
      hash_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      hijos: 0,
    });
    const acceso = await api()
      .get(`/api/evidencias/${confirmada.body.id}/acceso?vistaPrevia=true`)
      .set("X-Usuario-Id", LIDER_RS)
      .expect(200);
    expect(acceso.body).toMatchObject({ url: expect.stringContaining("sas=read"), expiraEnSegundos: 300 });
    await api().delete(`/api/evidencias/${confirmada.body.id}`).set("X-Usuario-Id", LIDER_RS).expect(200);
    await api().get(`/api/evidencias/${confirmada.body.id}/acceso`).set("X-Usuario-Id", LIDER_RS).expect(404);
  });

  it("HU_06: no permite solicitar el cierre con pendientes", async () => {
    const r = await api().post("/api/auditorias/2/solicitar-cierre").set("X-Usuario-Id", LIDER_RS).expect(409);
    expect(r.body.detalles.length).toBeGreaterThan(0);
  });

  it("HU_07: respeta el turno y exige motivo al rechazar", async () => {
    await api()
      .post("/api/auditorias/5/decision")
      .set("X-Usuario-Id", DIRECTOR)
      .send({ decision: "aprobado" })
      .expect(403);
    await api()
      .post("/api/auditorias/5/decision")
      .set("X-Usuario-Id", GERENTE_RS)
      .send({ decision: "rechazado", comentario: "no" })
      .expect(422);
  });

  it("HU_08: la firma del Director sella el expediente y la integridad se verifica", async () => {
    await api()
      .post("/api/auditorias/5/decision")
      .set("X-Usuario-Id", GERENTE_RS)
      .send({ decision: "aprobado" })
      .expect(200);
    const sello = await api()
      .post("/api/auditorias/5/decision")
      .set("X-Usuario-Id", DIRECTOR)
      .send({ decision: "aprobado" })
      .expect(200);
    expect(sello.body).toMatchObject({ estado: "cerrada", hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const integridad = await api().get("/api/auditorias/5/integridad").set("X-Usuario-Id", DIRECTOR).expect(200);
    expect(integridad.body).toMatchObject({
      datosIntactos: true,
      manifiestoIntacto: true,
      hashGuardado: sello.body.hash,
    });
  });

  describe("HU_09: alta de planes de remediación", () => {
    const db = () => app.get(BaseDeDatosMemoria);

    beforeEach(() => db().reiniciar());

    it("crea un plan con folio RP y estado abierto", async () => {
      const r = await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación para pagos.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(201);
      expect(r.body).toMatchObject({
        estado: "abierto",
        avance_pct: 0,
        hallazgo_id: 3,
        responsable_id: Number(AUDITADO),
        monto_mxn: 150000,
      });
      expect(r.body.tracking_id).toMatch(/^RP-\d{6}$/);
    });

    it("rechaza descripción vacía", async () => {
      const r = await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "   ",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(422);

      expect(r.body.detalles.descripcion).toBeDefined();
    });

    it("rechaza responsable inexistente", async () => {
      await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación.",
          responsableId: 999999,
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(404);
    });

    it("rechaza monto negativo", async () => {
      await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: -1,
        })
        .expect(422);
    });

    it("rechaza una fecha inválida", async () => {
      await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "fecha-invalida",
          montoMxn: 150000,
        })
        .expect(422);
    });

    it("rechaza un hallazgo que el usuario no puede ver", async () => {
      await api()
        .post("/api/planes")
        .set("X-Usuario-Id", AUDITADO)
        .send({
          hallazgoId: 1,
          descripcion: "Implementar doble validación.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(404);
    });

    it("notifica automáticamente al responsable", async () => {
      const r = await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación para pagos.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(201);

      const notificacion = db().notificaciones.find((n) => n.plan_id === r.body.id);

      expect(notificacion).toMatchObject({
        usuario_id: Number(AUDITADO),
        plan_id: r.body.id,
        tipo: "PLAN_ASIGNADO",
        canal: "plataforma",
        leida: false,
      });

      expect(notificacion?.fecha_envio).toBeInstanceOf(Date);
    });

    it("la fecha compromiso corresponde a las 23:59:59 en la zona de la unidad", async () => {
      const r = await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 3,
          descripcion: "Implementar doble validación para pagos.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-10-30",
          montoMxn: 150000,
        })
        .expect(201);

      const hallazgo = db().hallazgos.find((h) => h.id === 3)!;

      const auditoria = db().auditorias.find((a) => a.id === hallazgo.auditoria_id)!;

      const unidad = db().unidades.find((u) => u.id === auditoria.unidad_negocio_id)!;

      const fecha = new Date(r.body.fecha_compromiso);

      const partes = new Intl.DateTimeFormat("sv-SE", {
        timeZone: unidad.zona_horaria,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(fecha);

      const valores = Object.fromEntries(partes.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));

      expect(`${valores.year}-${valores.month}-${valores.day}`).toBe("2026-10-30");

      expect(`${valores.hour}:${valores.minute}:${valores.second}`).toBe("23:59:59");
    });
  });

  it("HU_10: el avance al 100 % pasa a revisión GRC y no puede retroceder", async () => {
    const r = await api()
      .post("/api/planes/1/avances")
      .set("X-Usuario-Id", AUDITADO)
      .send({ avance: 100, comentario: "Se removió el último conflicto de tesorería." })
      .expect(200);
    expect(r.body).toMatchObject({ estado: "revision_grc", avance_pct: 100 });
    await api()
      .post("/api/planes/2/avances")
      .set("X-Usuario-Id", AUDITADO)
      .send({ avance: 10, comentario: "Intento de bajar el avance." })
      .expect(409);
  });

  describe("CP-014 · Validación GRC → Jefatura y solventación", () => {
    const db = () => app.get(BaseDeDatosMemoria);
    const grc = "11",
      jefe = "6",
      auditado = "12",
      lider = "1";
    const validar = (id: number, usuario: string, decision = "aprobado", comentario?: string) => {
      const req = api()
        .post(`/api/planes/${id}/validacion`)
        .set("X-Usuario-Id", usuario)
        .send({ decision, ...(comentario === undefined ? {} : { comentario }) });
      return req;
    };

    beforeEach(() => db().reiniciar());

    it("camino feliz: 100 %, GRC, Jefatura y solventación al cerrar el último plan; conserva historial", async () => {
      const planes = db().planes.filter((p) => p.hallazgo_id === 3);
      for (const p of planes) Object.assign(p, { avance_pct: 100, estado: "revision_grc" });
      await validar(1, grc)
        .expect(200)
        .expect(({ body }) => expect(body.estado).toBe("revision_jefe"));
      await validar(1, jefe)
        .expect(200)
        .expect(({ body }) => expect(body.estado).toBe("cerrado"));
      expect(db().hallazgos.find((h) => h.id === 3)?.estado).not.toBe("solventado");
      await validar(2, grc).expect(200);
      await validar(2, jefe).expect(200);
      expect(db().hallazgos.find((h) => h.id === 3)?.estado).toBe("solventado");
      expect(db().bitacora.filter((b) => b.accion === "VALIDACION")).toHaveLength(4);
      expect(JSON.parse(db().bitacora.at(-1)!.detalle!)).toMatchObject({ etapa: "jefatura", decision: "aprobado" });
    });

    it("bloquea saltar GRC, avance menor a 100 % y rol incorrecto en ambas etapas", async () => {
      await validar(1, jefe).expect(409);
      await api().post("/api/planes/1/validacion").set("X-Usuario-Id", grc).send({ decision: "aprobado" }).expect(409);
      db().planes[0].avance_pct = 100;
      db().planes[0].estado = "revision_grc";
      await validar(1, jefe).expect(403);
      await validar(1, grc).expect(200);
      await validar(1, grc).expect(403);
      await validar(1, jefe).expect(200);
    });

    it("exige retroalimentación al rechazar y reinicia el ciclo desde GRC", async () => {
      Object.assign(db().planes[0], { avance_pct: 100, estado: "revision_grc" });
      await validar(1, grc, "rechazado").expect(422);
      await validar(1, grc, "rechazado", "La evidencia no demuestra operación efectiva.")
        .expect(200)
        .expect(({ body }) => expect(body.estado).toBe("en_progreso"));
      expect(JSON.parse(db().bitacora.at(-1)!.detalle!)).toMatchObject({
        etapa: "grc",
        decision: "rechazado",
        comentario: "La evidencia no demuestra operación efectiva.",
      });
      await api()
        .get("/api/planes/1")
        .set("X-Usuario-Id", auditado)
        .expect(200)
        .expect(({ body }) => expect(body.avances[0].comentario).toBe("La evidencia no demuestra operación efectiva."));
      Object.assign(db().planes[0], { estado: "revision_grc", avance_pct: 100 });
      await validar(1, grc)
        .expect(200)
        .expect(({ body }) => expect(body.estado).toBe("revision_jefe"));
    });

    it("solventa hallazgo de un solo plan al cerrarlo", async () => {
      const p = db().planes.find((x) => x.hallazgo_id === 3)!;
      const hallazgoId = p.hallazgo_id;
      db().planes.find((x) => x.id !== p.id && x.hallazgo_id === 3)!.hallazgo_id = 4;
      p.estado = "revision_grc";
      p.avance_pct = 100;
      await validar(p.id, grc).expect(200);
      await validar(p.id, jefe).expect(200);
      expect(db().hallazgos.find((h) => h.id === hallazgoId)?.estado).toBe("solventado");
    });

    it("evita doble aprobación concurrente del mismo estado", async () => {
      Object.assign(db().planes[0], { avance_pct: 100, estado: "revision_jefe" });
      const [a, b] = await Promise.all([validar(1, jefe).then((r) => r), validar(1, jefe).then((r) => r)]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(db().bitacora.filter((x) => x.accion === "VALIDACION" && x.entidad_id === 1)).toHaveLength(1);
    });
  });
  describe("HU_14: tablero", () => {
    const dashboard = (id: string) =>
      api()
        .get("/api/dashboard")
        .set("X-Usuario-Id", id)
        .expect(200)
        .then((r) => r.body);
    const suma = (xs: { total: number }[]) => xs.reduce((s, x) => s + x.total, 0);

    it("sin sesión responde 401", () => api().get("/api/dashboard").expect(401));

    it("los totales cuadran y responde en menos de 2 s", async () => {
      const inicio = Date.now();
      const d = await dashboard(DIRECTOR);
      expect(Date.now() - inicio).toBeLessThan(2000);
      expect(suma(d.hallazgos.porSeveridad)).toBe(d.hallazgos.total);
      expect(suma(d.hallazgos.porTipo)).toBe(d.hallazgos.total);
      expect(suma(d.planes.porSemaforo)).toBe(d.planes.total);
      expect(d.planes.porSemaforo.map((s: { semaforo: string }) => s.semaforo)).toEqual([
        "en_tiempo",
        "por_vencer",
        "demorado",
        "cerrado",
      ]);
      expect(d.hallazgos.porSemana).toHaveLength(8);
    });

    describe("cuellos de botella", () => {
      const cuellos = (id: string) =>
        api()
          .get("/api/dashboard/cuellos-de-botella")
          .set("X-Usuario-Id", id)
          .expect(200)
          .then((r) => r.body);

      it("sin sesión responde 401", () => api().get("/api/dashboard/cuellos-de-botella").expect(401));

      it("el Director ve el resumen consistente y responde en menos de 2 s", async () => {
        const inicio = Date.now();
        const d = await cuellos(DIRECTOR);
        expect(Date.now() - inicio).toBeLessThan(2000);
        expect(d.resumen.auditoriasEnAprobacion).toBe(d.aprobaciones.length);
        expect(d.hallazgosSinPlan.length).toBeLessThanOrEqual(Math.min(10, d.resumen.hallazgosSinPlan));
        expect(d.procedimientos.length).toBeLessThanOrEqual(Math.min(10, d.resumen.procedimientosEstancados));
      });

      it("el auditado no ve procedimientos ni aprobaciones y sus hallazgos son un subconjunto", async () => {
        const [dir, auditado] = await Promise.all([cuellos(DIRECTOR), cuellos(AUDITADO)]);
        expect(auditado.procedimientos).toEqual([]);
        expect(auditado.aprobaciones).toEqual([]);
        expect(auditado.resumen.hallazgosSinPlan).toBeLessThanOrEqual(dir.resumen.hallazgosSinPlan);
      });

      it("el líder de Retail & Spin no ve más que el Director", async () => {
        const [dir, lider] = await Promise.all([cuellos(DIRECTOR), cuellos(LIDER_RS)]);
        expect(lider.resumen.procedimientosEstancados).toBeLessThanOrEqual(dir.resumen.procedimientosEstancados);
        expect(lider.resumen.auditoriasEnAprobacion).toBeLessThanOrEqual(dir.resumen.auditoriasEnAprobacion);
      });
    });

    it("respeta la seguridad por fila: Dirección y auditado ven menos que el Director", async () => {
      const [dir, lider, auditado] = await Promise.all([dashboard(DIRECTOR), dashboard(LIDER_RS), dashboard(AUDITADO)]);
      expect(lider.hallazgos.total).toBeLessThanOrEqual(dir.hallazgos.total);
      expect(auditado.hallazgos.total).toBeLessThanOrEqual(dir.hallazgos.total);
      expect(auditado.planes.total).toBeLessThanOrEqual(dir.planes.total);
      const procs = (x: { procedimientos: Record<string, number> }) =>
        Object.values(x.procedimientos).reduce((s, n) => s + n, 0);
      expect(procs(lider)).toBeLessThanOrEqual(procs(dir));
    });
  });

  describe("HU_15 · Bitácora", () => {
    const AUDITOR = "3";

    it("el Director consulta operaciones y accesos", async () => {
      const r = await api().get("/api/bitacora").set("X-Usuario-Id", DIRECTOR).expect(200);
      expect(Array.isArray(r.body.operaciones)).toBe(true);
      expect(Array.isArray(r.body.accesos)).toBe(true);
    });

    it("auditor y auditado reciben 403 y queda como acceso denegado", async () => {
      await api().get("/api/bitacora").set("X-Usuario-Id", AUDITOR).expect(403);
      await api().get("/api/bitacora").set("X-Usuario-Id", AUDITADO).expect(403);
      const r = await api()
        .get("/api/bitacora")
        .query({ usuarioId: AUDITADO })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.body.accesos[0]).toMatchObject({ resultado: "denegado", usuario: "E. Ramos" });
    });

    it("registra el inicio de sesión exitoso y el fallido", async () => {
      const ok = await api()
        .post("/api/sesion")
        .set("User-Agent", "Prueba e2e")
        .send({ ...CUENTA_DEMO, zonaHoraria: "America/Monterrey" })
        .expect(201);
      expect(ok.body).toMatchObject({ nombre: "José Martínez", rol: "lider" });
      expect(ok.body).not.toHaveProperty("contrasena_hash");
      await api().post("/api/sesion").send({ correo: CUENTA_DEMO.correo, contrasena: "incorrecta" }).expect(401);
      await api()
        .post("/api/sesion")
        .send({ correo: "d.herrera@demo.femsa.test", contrasena: "cualquiera" })
        .expect(401);
      const r = await api().get("/api/bitacora").set("X-Usuario-Id", DIRECTOR).expect(200);
      const resultados = r.body.accesos.map((a: { resultado: string }) => a.resultado);
      expect(resultados).toEqual(expect.arrayContaining(["exito", "fallo"]));
      expect(r.body.accesos.find((a: { agente: string }) => a.agente === "Prueba e2e")).toMatchObject({
        resultado: "exito",
        zona_horaria: "America/Monterrey",
      });
    });

    it("rechaza filtros inválidos con 422", () =>
      api().get("/api/bitacora").query({ desde: "ayer", accion: "BORRAR" }).set("X-Usuario-Id", DIRECTOR).expect(422));

    it("FE1S-36: el feed liga cada operación a su auditoría y muestra los cambios", async () => {
      app.get(BaseDeDatosMemoria).reiniciar();
      await api()
        .post("/api/planes/1/avances")
        .set("X-Usuario-Id", AUDITADO)
        .send({ avance: 80, comentario: "Se depuraron las partidas pendientes." });
      const r = await api()
        .get("/api/bitacora/operaciones")
        .query({ entidad: "planes" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      const op = r.body.filas.find((o: { folio: string }) => o.folio === "RP-000001");
      expect(op).toMatchObject({
        auditoria_folio: expect.stringMatching(/^AUD-/),
        usuario: "E. Ramos",
        rol: "auditado",
      });
      expect(op.cambios).toEqual(
        expect.arrayContaining([expect.objectContaining({ campo: "avance_pct", despues: 80 })]),
      );
    });

    it("FE1S-36: filtra por auditoría y pagina con el total real", async () => {
      const todas = await api().get("/api/bitacora/operaciones").set("X-Usuario-Id", DIRECTOR).expect(200);
      const auditoria = todas.body.filas.find((o: { auditoria_id: number | null }) => o.auditoria_id).auditoria_id;
      const r = await api()
        .get("/api/bitacora/operaciones")
        .query({ auditoriaId: auditoria, limite: 1 })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.body.filas).toHaveLength(1);
      expect(r.body.filas[0].auditoria_id).toBe(auditoria);
      expect(r.body.total).toBeGreaterThanOrEqual(1);
      expect(r.body).toMatchObject({ pagina: 1, limite: 1 });
    });

    it("FE1S-36: accesos filtrados por resultado", async () => {
      await api().get("/api/bitacora").set("X-Usuario-Id", AUDITADO).expect(403);
      const r = await api()
        .get("/api/bitacora/accesos")
        .query({ resultado: "denegado" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.body.filas.length).toBeGreaterThan(0);
      expect(r.body.filas.every((a: { resultado: string }) => a.resultado === "denegado")).toBe(true);
    });

    it("FE1S-36: exporta CSV y la exportación queda registrada", async () => {
      const r = await api()
        .get("/api/bitacora/exportar")
        .query({ tipo: "operaciones" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.headers["content-type"]).toMatch(/text\/csv/);
      expect(r.headers["content-disposition"]).toMatch(/bitacora-operaciones-/);
      expect(r.text.split("\n")[0]).toContain("fecha_utc,usuario,rol,accion");
      const ops = await api()
        .get("/api/bitacora/operaciones")
        .query({ accion: "EXPORTAR" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(ops.body.filas[0]).toMatchObject({ folio: "BITACORA-OPERACIONES", usuario: "D. Herrera" });
    });

    it("exporta solo las columnas elegidas y rechaza listas mal formadas", async () => {
      const r = await api()
        .get("/api/bitacora/exportar")
        .query({ tipo: "accesos", columnas: "ip,fecha_utc" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.text.replace(/^\uFEFF/, "").split("\n")[0]).toBe("fecha_utc,ip");
      await api()
        .get("/api/bitacora/exportar")
        .query({ columnas: "fecha;drop" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(422);
    });
  });

  describe("HU_16 · Bitácora de avances", () => {
    const db = () => app.get(BaseDeDatosMemoria);
    const pausa = () => new Promise((r) => setTimeout(r, 5));
    beforeEach(() => db().reiniciar());

    it("el historial del plan muestra usuario, porcentaje, comentario y fecha, del más reciente al más antiguo", async () => {
      await api()
        .post("/api/planes/1/avances")
        .set("X-Usuario-Id", AUDITADO)
        .send({ avance: 70, comentario: "Se depuraron los roles de tesorería." })
        .expect(200);
      await pausa();
      await api()
        .post("/api/planes/1/avances")
        .set("X-Usuario-Id", AUDITADO)
        .send({ avance: 80, comentario: "Se configuró la segregación en el ERP." })
        .expect(200);
      const r = await api().get("/api/planes/1").set("X-Usuario-Id", LIDER_RS).expect(200);
      expect(r.body.avances.length).toBeGreaterThanOrEqual(2);
      expect(r.body.avances[0]).toMatchObject({
        avance_pct: 80,
        comentario: "Se configuró la segregación en el ERP.",
        usuario: "E. Ramos",
      });
      expect(r.body.avances[1]).toMatchObject({ avance_pct: 70, usuario: "E. Ramos" });
      const fechas = r.body.avances.map((a: { fecha: string }) => new Date(a.fecha).getTime());
      expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });

    it("el Director consulta la bitácora consolidada, ordenada del más reciente al más antiguo", async () => {
      await api()
        .post("/api/planes/1/avances")
        .set("X-Usuario-Id", AUDITADO)
        .send({ avance: 75, comentario: "Avance registrado para la bitácora general." })
        .expect(200);
      const r = await api().get("/api/planes/avances").set("X-Usuario-Id", DIRECTOR).expect(200);
      expect(r.body[0]).toMatchObject({
        plan_id: 1,
        avance_pct: 75,
        comentario: "Avance registrado para la bitácora general.",
        usuario: "E. Ramos",
      });
      expect(r.body[0]).toEqual(
        expect.objectContaining({
          tracking_id: expect.stringMatching(/^RP-\d{6}$/),
          auditoria_folio: expect.any(String),
          responsable: expect.any(String),
          fecha: expect.any(String),
        }),
      );
      const fechas = r.body.map((a: { fecha: string }) => new Date(a.fecha).getTime());
      expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });

    it("los demás roles reciben 403 en la bitácora consolidada", async () => {
      for (const usuario of [LIDER_RS, GERENTE_RS, AUDITADO])
        await api().get("/api/planes/avances").set("X-Usuario-Id", usuario).expect(403);
    });
  });

  describe("HU_17 · Registro desde el contexto", () => {
    const db = () => app.get(BaseDeDatosMemoria);
    beforeEach(() => db().reiniciar());

    it("el detalle de la auditoría trae impacto y recomendación de cada hallazgo para precargar el plan", async () => {
      const r = await api().get("/api/auditorias/8").set("X-Usuario-Id", DIRECTOR).expect(200);
      const h = r.body.hallazgos.find((x: { tracking_id: string }) => x.tracking_id === "FND-000009");
      expect(h).toMatchObject({ impacto_mxn: 340000, recomendacion: expect.any(String) });
    });

    it("crea un plan sobre un hallazgo de una auditoría cerrada sin alterar el sello del expediente", async () => {
      // reiniciar() borra los sellos; se vuelven a generar como al arrancar la API.
      await app.get(SelladoService).onApplicationBootstrap();
      const r = await api()
        .post("/api/planes")
        .set("X-Usuario-Id", LIDER_RS)
        .send({
          hallazgoId: 4,
          descripcion: "Depurar partidas con antigüedad mayor a 90 días.",
          responsableId: Number(AUDITADO),
          fechaCompromiso: "2026-12-15",
          montoMxn: 210000,
        })
        .expect(201);
      expect(r.body).toMatchObject({ hallazgo_folio: "FND-000004", auditoria_folio: "AUD-000004", estado: "abierto" });
      const integridad = await api().get("/api/auditorias/4/integridad").set("X-Usuario-Id", DIRECTOR).expect(200);
      expect(integridad.body).toMatchObject({ datosIntactos: true, manifiestoIntacto: true });
    });

    it("el responsable se elige entre los usuarios auditados de la lista de usuarios", async () => {
      const r = await api().get("/api/usuarios").set("X-Usuario-Id", LIDER_RS).expect(200);
      const auditados = r.body.filter((u: { rol: string }) => u.rol === "auditado");
      expect(auditados.length).toBeGreaterThan(0);
      expect(auditados.map((u: { id: number }) => u.id)).toContain(Number(AUDITADO));
    });
  });

  describe("HU_12 · Notificaciones", () => {
    const db = () => app.get(BaseDeDatosMemoria);
    beforeEach(() => db().reiniciar());

    it("la revisión diaria avisa al responsable 15, 5 y 1 día antes y escala lo vencido al líder y al gerente", async () => {
      const r = await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", LIDER_RS).expect(201);
      const tipos = r.body.enviadas.map((e: { tipo: string }) => e.tipo);
      expect(tipos).toEqual(
        expect.arrayContaining(["vencimiento_15", "vencimiento_5", "vencimiento_1", "escalamiento"]),
      );
      const auditado = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITADO).expect(200);
      expect(auditado.body.items.map((n: { tipo: string }) => n.tipo)).toEqual(
        expect.arrayContaining(["vencimiento_5", "vencimiento_1"]),
      );
      expect(auditado.body.items.find((n: { tipo: string }) => n.tipo.startsWith("vencimiento_"))).toMatchObject({
        plan_folio: expect.stringMatching(/^RP-/),
        auditoria_folio: expect.stringMatching(/^AUD-/),
        leida: false,
      });
      const gerente = await api().get("/api/notificaciones").set("X-Usuario-Id", GERENTE_RS).expect(200);
      expect(gerente.body.items.some((n: { tipo: string }) => n.tipo === "escalamiento")).toBe(true);
    });

    it("correrla dos veces el mismo día no repite avisos", async () => {
      await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", LIDER_RS).expect(201);
      const otra = await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", LIDER_RS).expect(201);
      expect(otra.body.enviadas).toEqual([]);
    });

    it("sólo líder o admin la corren a mano; el cron exige su secreto", async () => {
      await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", AUDITADO).expect(403);
      await api().get("/api/notificaciones/cron/vencimientos").expect(401);
      process.env.CRON_SECRET = "secreto-e2e";
      await api().get("/api/notificaciones/cron/vencimientos").set("Authorization", "Bearer secreto-e2e").expect(200);
      delete process.env.CRON_SECRET;
    });

    it("marca un aviso o todos como leídos, y nadie marca los de otro usuario", async () => {
      await api().post("/api/notificaciones/simular").set("X-Usuario-Id", AUDITADO).send({}).expect(201);
      const antes = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITADO).expect(200);
      expect(antes.body.noLeidas).toBe(7);
      const id = antes.body.items[0].id;
      await api().post(`/api/notificaciones/${id}/leida`).set("X-Usuario-Id", LIDER_RS).expect(404);
      const una = await api().post(`/api/notificaciones/${id}/leida`).set("X-Usuario-Id", AUDITADO).expect(201);
      expect(una.body.noLeidas).toBe(6);
      const pendientes = await api()
        .get("/api/notificaciones")
        .query({ estado: "no_leidas" })
        .set("X-Usuario-Id", AUDITADO)
        .expect(200);
      expect(pendientes.body.items).toHaveLength(6);
      await api().post("/api/notificaciones/leidas").set("X-Usuario-Id", AUDITADO).expect(201);
      expect((await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITADO)).body.noLeidas).toBe(0);
    });

    it("rechazar un plan avisa a su responsable", async () => {
      const plan = db().planes[0];
      Object.assign(plan, { avance_pct: 100, estado: "revision_grc" });
      await api()
        .post(`/api/planes/${plan.id}/validacion`)
        .set("X-Usuario-Id", "11")
        .send({ decision: "rechazado", comentario: "Falta la evidencia del cierre." })
        .expect(200);
      const r = await api().get("/api/notificaciones").set("X-Usuario-Id", String(plan.responsable_id)).expect(200);
      expect(r.body.items[0]).toMatchObject({ tipo: "plan_rechazado", plan_id: plan.id });
      expect(r.body.items[0].mensaje).toContain("Falta la evidencia del cierre.");
    });
  });

  describe("HU_05 · Solicitudes de información (PBC)", () => {
    const db = () => app.get(BaseDeDatosMemoria);
    const AUDITOR = "3";
    beforeEach(() => db().reiniciar());
    const procedimientoDe = (auditoria: number) => db().procedimientos.find((p) => p.auditoria_id === auditoria)!.id;
    const nueva = (extra: Record<string, unknown> = {}) => ({
      auditoriaId: 2,
      procedimientoId: procedimientoDe(2),
      solicitadoAId: Number(AUDITADO),
      fechaLimite: "2099-12-31",
      asunto: "Soporte de pagos de octubre",
      puntos: [{ descripcion: "Autorizaciones de pago firmadas" }, { descripcion: "Facturas de los pagos" }],
      ...extra,
    });

    it("el auditor pide información con puntos, responsable y fecha; el auditado recibe el aviso", async () => {
      const r = await api().post("/api/pbc").set("X-Usuario-Id", AUDITOR).send(nueva()).expect(201);
      expect(r.body).toMatchObject({
        tracking_id: expect.stringMatching(/^PBC-\d{6}$/),
        estado: "solicitada",
        solicitado_a: "E. Ramos",
        cubiertos: 0,
      });
      expect(r.body.puntos).toHaveLength(2);
      const avisos = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITADO).expect(200);
      expect(avisos.body.items[0]).toMatchObject({ tipo: "solicitud_pbc" });
      expect(avisos.body.items[0].mensaje).toContain(r.body.tracking_id);
    });

    it("valida responsable, fecha y puntos", async () => {
      await api()
        .post("/api/pbc")
        .set("X-Usuario-Id", AUDITOR)
        .send(nueva({ solicitadoAId: 3 }))
        .expect(400);
      await api()
        .post("/api/pbc")
        .set("X-Usuario-Id", AUDITOR)
        .send(nueva({ fechaLimite: "2020-01-01" }))
        .expect(400);
      await api()
        .post("/api/pbc")
        .set("X-Usuario-Id", AUDITOR)
        .send(nueva({ puntos: [] }))
        .expect(422);
      await api().post("/api/pbc").set("X-Usuario-Id", AUDITADO).send(nueva()).expect(403);
    });

    it("el auditado solo ve las solicitudes que le tocan y las vencidas salen marcadas", async () => {
      const r = await api().get("/api/pbc").set("X-Usuario-Id", AUDITADO).expect(200);
      expect(r.body.length).toBeGreaterThan(0);
      expect(
        r.body.every(
          (s: { solicitado_a_id: number | null }) =>
            s.solicitado_a_id === Number(AUDITADO) || s.solicitado_a_id === null,
        ),
      ).toBe(true);
      expect(r.body.some((s: { vencida: boolean }) => s.vencida)).toBe(true);
    });

    it("responder con un lote la pasa a enviada y avisa a quien la pidió", async () => {
      const s = (await api().post("/api/pbc").set("X-Usuario-Id", AUDITOR).send(nueva()).expect(201)).body;
      const evidencia =
        db().evidencias.find(
          (e) =>
            e.procedimiento_id &&
            db().procedimientos.find((p) => p.id === e.procedimiento_id)?.auditoria_id === 2 &&
            !e.evidencia_padre_id &&
            e.cargado_por_id === Number(AUDITADO),
        ) ??
        (() => {
          const e = db().evidencias.find(
            (x) =>
              !x.evidencia_padre_id && db().procedimientos.find((p) => p.id === x.procedimiento_id)?.auditoria_id === 2,
          )!;
          e.cargado_por_id = Number(AUDITADO);
          return e;
        })();
      await api()
        .post("/api/lotes")
        .set("X-Usuario-Id", AUDITADO)
        .send({ auditoriaId: 2, solicitudPbcId: s.id, evidencias: [evidencia.id] })
        .expect(201);
      const detalle = await api().get(`/api/pbc/${s.id}`).set("X-Usuario-Id", AUDITOR).expect(200);
      expect(detalle.body).toMatchObject({ estado: "enviada", enviado: expect.any(String) });
      const avisos = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITOR).expect(200);
      expect(avisos.body.items.some((n: { tipo: string }) => n.tipo === "solicitud_pbc_respondida")).toBe(true);
      await api()
        .post("/api/lotes")
        .set("X-Usuario-Id", AUDITADO)
        .send({ auditoriaId: 2, solicitudPbcId: s.id, evidencias: [evidencia.id] })
        .expect(409);
    });

    it("el auditor revisa punto por punto: pedir corrección exige comentario; aceptar la completa", async () => {
      const enviada = db().solicitudesPbc.find((x) => x.estado === "enviada")!;
      const puntos = db().puntosPbc.filter((p) => p.solicitud_id === enviada.id);
      await api()
        .post(`/api/pbc/${enviada.id}/revision`)
        .set("X-Usuario-Id", AUDITOR)
        .send({ decision: "reenviar" })
        .expect(400);
      const r = await api()
        .post(`/api/pbc/${enviada.id}/revision`)
        .set("X-Usuario-Id", AUDITOR)
        .send({
          decision: "reenviar",
          comentario: "Falta la bitácora de cambios.",
          puntos: [
            { id: puntos[0].id, estado: "cubierto" },
            { id: puntos[1].id, estado: "faltante" },
          ],
        })
        .expect(201);
      expect(r.body).toMatchObject({
        estado: "reenviar",
        comentario_revision: "Falta la bitácora de cambios.",
        cubiertos: 1,
      });
      const avisos = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITADO).expect(200);
      expect(avisos.body.items[0]).toMatchObject({ tipo: "solicitud_pbc_reenviar" });
      db().solicitudesPbc.find((x) => x.id === enviada.id)!.estado = "enviada";
      const ok = await api()
        .post(`/api/pbc/${enviada.id}/revision`)
        .set("X-Usuario-Id", AUDITOR)
        .send({ decision: "completa", puntos: puntos.map((p) => ({ id: p.id, estado: "cubierto" })) })
        .expect(201);
      expect(ok.body).toMatchObject({ estado: "completa", cubiertos: puntos.length, cerrado: expect.any(String) });
    });

    it("la revisión diaria avisa antes del vencimiento y escala las vencidas a quien pidió", async () => {
      const r = await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", LIDER_RS).expect(201);
      const tipos = r.body.enviadas.map((e: { tipo: string }) => e.tipo);
      expect(tipos).toEqual(expect.arrayContaining(["pbc_vencimiento_5", "pbc_vencida"]));
      const auditor = await api().get("/api/notificaciones").set("X-Usuario-Id", AUDITOR).expect(200);
      expect(auditor.body.items.some((n: { tipo: string }) => n.tipo === "pbc_vencida")).toBe(true);
      const otra = await api().post("/api/notificaciones/vencimientos").set("X-Usuario-Id", LIDER_RS).expect(201);
      expect(otra.body.enviadas).toEqual([]);
    });
  });

  describe("HU_13 · Informe ejecutivo", () => {
    it("trae indicadores, auditorías, hallazgos principales y planes demorados", async () => {
      const r = await api().get("/api/reporte").set("X-Usuario-Id", DIRECTOR).expect(200);
      expect(r.body).toMatchObject({ generadoPor: "D. Herrera", cumplimiento: expect.any(Number) });
      expect(r.body.auditorias.lista.length).toBe(r.body.auditorias.total);
      expect(r.body.hallazgos.principales[0]).toMatchObject({
        tracking_id: expect.stringMatching(/^FND-/),
        severidad: "Crítica",
      });
      expect(r.body.planes.demorados.every((p: { semaforo: string }) => p.semaforo === "demorado")).toBe(true);
      expect(Array.isArray(r.body.expedientesSellados)).toBe(true);
    });

    it("respeta la seguridad por fila y los roles", async () => {
      const director = await api().get("/api/reporte").set("X-Usuario-Id", DIRECTOR).expect(200);
      const lider = await api().get("/api/reporte").set("X-Usuario-Id", LIDER_RS).expect(200);
      expect(lider.body.auditorias.total).toBeLessThan(director.body.auditorias.total);
      await api().get("/api/reporte").set("X-Usuario-Id", AUDITADO).expect(403);
    });

    it("registra la descarga del PDF en la bitácora", async () => {
      await api().post("/api/reporte/exportaciones").set("X-Usuario-Id", DIRECTOR).expect(204);
      const r = await api()
        .get("/api/bitacora/operaciones")
        .query({ accion: "EXPORTAR" })
        .set("X-Usuario-Id", DIRECTOR)
        .expect(200);
      expect(r.body.filas.some((o: { folio: string }) => o.folio === "INFORME-EJECUTIVO")).toBe(true);
    });
  });
});
