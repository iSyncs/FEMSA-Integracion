import { ConflictException, Injectable } from "@nestjs/common";
import { ConexionSql, Ejecutor, siguienteFolio } from "./conexion-sql";
import { UsuariosRepository, CatalogosRepository } from "../repositorios/usuarios.repository";
import { AuditoriasRepository, NuevaAuditoria } from "../repositorios/auditorias.repository";
import { HallazgosRepository, NuevoHallazgo } from "../repositorios/hallazgos.repository";
import { PlanesRepository } from "../repositorios/planes.repository";
import { CierreRepository } from "../repositorios/cierre.repository";
import {
  AccesoVista,
  BitacoraRepository,
  FiltrosAccesos,
  FiltrosOperaciones,
  NuevaOperacion,
  NuevoAcceso,
  OperacionVista,
  Pagina,
} from "../repositorios/bitacora.repository";
import { EstadoDatos } from "../repositorios/estado-datos";
import type {
  Acceso,
  Aprobacion,
  Auditoria,
  Avance,
  Cierre,
  Control,
  EstadoAuditoria,
  EstadoProcedimiento,
  EvaluacionProcedimiento,
  Hallazgo,
  NivelAprobacion,
  Plan,
  Procedimiento,
  RegistroBitacora,
  Riesgo,
  UnidadNegocio,
} from "../modelos";
import type {
  AprobacionVista,
  AuditoriaVista,
  EvidenciaVista,
  HallazgoVista,
  PlanVista,
  ProcedimientoVista,
  UsuarioSesion,
} from "../repositorios/vistas";
import type { Contexto } from "../../auth/decoradores";

type Fila = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));
const segundos = () => new Date(new Date().toISOString().slice(0, 19) + "Z");

// ---------- Usuarios y catálogos ----------

const SQL_USUARIO = `
  SELECT u.user_id AS id, u.full_name AS nombre, u.email AS correo, u.direction AS direccion, u.business_unit_id AS unidad_negocio_id,
         COALESCE(u.time_zone, 'America/Monterrey') AS zona_horaria, r.code AS rol, r.name AS rol_nombre, bu.unity AS unidad
    FROM dbo.[USER] u
    JOIN dbo.[ROLE] r ON r.role_id = u.role_id
    LEFT JOIN dbo.BUSINESS_UNIT bu ON bu.business_unit_id = u.business_unit_id
   WHERE u.is_active = 1 AND r.code IS NOT NULL`;

@Injectable()
export class UsuariosSqlRepository extends UsuariosRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async listarActivos() {
    return this.db.consulta<UsuarioSesion>(`${SQL_USUARIO} ORDER BY r.role_id, u.full_name`);
  }

  async buscarActivo(id: number) {
    return (await this.db.consulta<UsuarioSesion>(`${SQL_USUARIO} AND u.user_id = @id`, { id }))[0] ?? null;
  }

  async credencial(correo: string) {
    // La contraseña se guarda solo como hash bcrypt en dbo.[USER].password_hash (ver scripts/user_password.sql).
    const [u] = await this.db.consulta<{ id: number; contrasena_hash: string | null }>(
      `
      SELECT u.user_id AS id, u.password_hash AS contrasena_hash
        FROM dbo.[USER] u WHERE u.is_active = 1 AND u.email = @correo`,
      { correo: correo.trim().toLowerCase() },
    );
    return u ?? null;
  }
}

@Injectable()
export class CatalogosSqlRepository extends CatalogosRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  private readonly sqlUnidad = `
    SELECT business_unit_id AS id, code AS clave, unity AS unidad, direction AS direccion, division, area, country AS pais, time_zone AS zona_horaria
      FROM dbo.BUSINESS_UNIT WHERE code IS NOT NULL`;

  async unidades() {
    return this.db.consulta<UnidadNegocio>(`${this.sqlUnidad} ORDER BY direction, unity`);
  }

  async unidad(id: number) {
    return (await this.db.consulta<UnidadNegocio>(`${this.sqlUnidad} AND business_unit_id = @id`, { id }))[0] ?? null;
  }

  async controles() {
    return this.db.consulta<Control & { riesgo_folio: string; riesgo: string }>(`
      SELECT c.control_id AS id, c.tracking_id, c.name AS nombre, c.domain AS dominio, c.risk_id AS riesgo_id,
             r.tracking_id AS riesgo_folio, r.name AS riesgo
        FROM dbo.CONTROL c JOIN dbo.RISK r ON r.risk_id = c.risk_id ORDER BY c.tracking_id`);
  }

  async riesgos() {
    return this.db.consulta<Riesgo>(`
      SELECT risk_id AS id, tracking_id, name AS nombre, category AS categoria, inherent_level AS nivel_inherente FROM dbo.RISK ORDER BY tracking_id`);
  }
}

// ---------- Auditorías y procedimientos ----------

const SQL_AUDITORIA = `
  SELECT a.audit_id AS id, a.tracking_id, a.name AS nombre, a.objective AS objetivo, a.business_unit_id AS unidad_negocio_id,
         a.audit_type AS tipo, a.area, a.priority AS prioridad, a.user_id AS lider_id, a.state AS estado,
         a.start_date AS fecha_inicio, a.end_date AS fecha_fin, a.created_at AS creado_en,
         bu.unity AS unidad, bu.direction AS direccion, bu.country AS pais, bu.time_zone AS zona_horaria, COALESCE(u.full_name, '') AS lider,
         (SELECT COUNT(*) FROM dbo.[PROCEDURE] p WHERE p.audit_id = a.audit_id) AS procedimientos,
         (SELECT COUNT(*) FROM dbo.[PROCEDURE] p WHERE p.audit_id = a.audit_id AND p.state = 'supervisado') AS supervisados,
         (SELECT COUNT(*) FROM dbo.FINDING f WHERE f.audit_id = a.audit_id AND f.state NOT IN ('solventado', 'rechazado')) AS hallazgos_abiertos,
         (SELECT COUNT(*) FROM dbo.FINDING f WHERE f.audit_id = a.audit_id AND f.state NOT IN ('solventado', 'rechazado') AND f.severity = N'Crítica') AS hallazgos_criticos
    FROM dbo.AUDIT a
    JOIN dbo.BUSINESS_UNIT bu ON bu.business_unit_id = a.business_unit_id
    LEFT JOIN dbo.[USER] u ON u.user_id = a.user_id
   WHERE a.name IS NOT NULL`;

const SQL_PROCEDIMIENTO = `
  SELECT p.procedure_id AS id, p.tracking_id, p.audit_id AS auditoria_id, p.control_id, p.auditor_id, p.state AS estado,
         p.design_rating AS calif_diseno, p.effectiveness_rating AS calif_efectividad, p.vulnerability AS vulnerabilidad,
         p.applies_finding AS aplica_hallazgo, p.comments AS comentarios, p.evaluated_at AS fecha_evaluacion,
         c.tracking_id AS control_folio, c.name AS control, r.tracking_id AS riesgo_folio, r.name AS riesgo, u.full_name AS auditor
    FROM dbo.[PROCEDURE] p
    JOIN dbo.CONTROL c ON c.control_id = p.control_id
    JOIN dbo.RISK r ON r.risk_id = c.risk_id
    LEFT JOIN dbo.[USER] u ON u.user_id = p.auditor_id`;

const procedimientoBase = (p: ProcedimientoVista): Procedimiento => ({
  id: p.id,
  tracking_id: p.tracking_id,
  auditoria_id: p.auditoria_id,
  control_id: p.control_id,
  auditor_id: p.auditor_id,
  estado: p.estado,
  calif_diseno: p.calif_diseno,
  calif_efectividad: p.calif_efectividad,
  vulnerabilidad: p.vulnerabilidad,
  aplica_hallazgo: p.aplica_hallazgo,
  comentarios: p.comentarios,
  fecha_evaluacion: p.fecha_evaluacion,
});

@Injectable()
export class AuditoriasSqlRepository extends AuditoriasRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async listar() {
    const prioridad = { Alta: 0, Media: 1, Baja: 2 };
    return (await this.db.consulta<AuditoriaVista>(SQL_AUDITORIA)).sort(
      (x, y) =>
        Number(x.estado === "cerrada") - Number(y.estado === "cerrada") ||
        prioridad[x.prioridad] - prioridad[y.prioridad] ||
        (x.fecha_fin?.getTime() ?? 0) - (y.fecha_fin?.getTime() ?? 0),
    );
  }

  async buscar(id: number) {
    return (await this.db.consulta<AuditoriaVista>(`${SQL_AUDITORIA} AND a.audit_id = @id`, { id }))[0] ?? null;
  }

  async crear(d: NuevaAuditoria) {
    return this.db.transaccion(async (tx) => {
      const tracking_id = await siguienteFolio(tx, "AUDIT", "AUD");
      const [r] = await tx.consulta<{ id: number; creado_en: Date }>(
        `
        INSERT INTO dbo.AUDIT (tracking_id, state, user_id, name, objective, business_unit_id, audit_type, area, priority, start_date, end_date)
        OUTPUT INSERTED.audit_id AS id, INSERTED.created_at AS creado_en
        VALUES (@tracking_id, 'pendiente', @lider, @nombre, @objetivo, @unidad, @tipo, @area, @prioridad, @inicio, @fin)`,
        {
          tracking_id,
          lider: d.lider_id,
          nombre: d.nombre,
          objetivo: d.objetivo,
          unidad: d.unidad_negocio_id,
          tipo: d.tipo,
          area: d.area,
          prioridad: d.prioridad,
          inicio: d.fecha_inicio,
          fin: d.fecha_fin,
        },
      );
      return { ...d, id: r.id, tracking_id, estado: "pendiente", creado_en: r.creado_en } satisfies Auditoria;
    });
  }

  async cambiarEstado(id: number, estado: EstadoAuditoria) {
    await this.db.consulta("UPDATE dbo.AUDIT SET state = @estado WHERE audit_id = @id", { id, estado });
  }

  async auditoriasDeParticipante(usuarioId: number) {
    return (
      await this.db.consulta<{ id: number }>(
        "SELECT audit_id AS id FROM dbo.AUDIT_PARTICIPANT WHERE user_id = @usuarioId",
        { usuarioId },
      )
    ).map((r) => r.id);
  }

  async procedimientos(auditoriaId: number) {
    return this.db.consulta<ProcedimientoVista>(
      `${SQL_PROCEDIMIENTO} WHERE p.audit_id = @auditoriaId ORDER BY p.procedure_id`,
      { auditoriaId },
    );
  }

  async procedimiento(id: number) {
    return (
      (await this.db.consulta<ProcedimientoVista>(`${SQL_PROCEDIMIENTO} WHERE p.procedure_id = @id`, { id }))[0] ?? null
    );
  }

  async evaluarProcedimiento(id: number, ev: EvaluacionProcedimiento, ctx: Contexto) {
    return this.db.transaccion(async (tx) => {
      await tx.consulta(
        `
        UPDATE dbo.[PROCEDURE] SET design_rating = @diseno, effectiveness_rating = @efectividad, vulnerability = @vulnerabilidad,
               comments = @comentarios, state = 'evaluado', evaluated_at = SYSUTCDATETIME()
         WHERE procedure_id = @id`,
        {
          id,
          diseno: ev.calif_diseno,
          efectividad: ev.calif_efectividad,
          vulnerabilidad: ev.vulnerabilidad,
          comentarios: ev.comentarios,
        },
      );
      const [p] = await tx.consulta<ProcedimientoVista>(`${SQL_PROCEDIMIENTO} WHERE p.procedure_id = @id`, { id });
      await tx.consulta(
        `
        INSERT INTO dbo.AUDIT_LOG (entity, entity_id, tracking_id, action, user_id, detail, ip, time_zone)
        VALUES ('procedimientos_auditoria', @id, @folio, 'EVALUAR', @usuario, @detalle, @ip, @zona)`,
        {
          id,
          folio: p.tracking_id,
          usuario: ctx.usuario.id,
          ip: ctx.ip,
          zona: ctx.zonaHoraria,
          detalle: JSON.stringify({
            diseno: p.calif_diseno,
            efectividad: p.calif_efectividad,
            vulnerabilidad_historica: p.vulnerabilidad,
            estado: p.estado,
            avance: 70,
          }),
        },
      );
      return procedimientoBase(p);
    });
  }

  async procedimientosPorEstado(auditoriaIds: number[]) {
    const conteo: Record<EstadoProcedimiento, number> = {
      abierto: 0,
      evaluado: 0,
      revisado: 0,
      supervisado: 0,
      rechazado: 0,
    };
    if (!auditoriaIds.length) return conteo;
    const filas = await this.db.consulta<{ estado: EstadoProcedimiento; n: number }>(
      `
      SELECT state AS estado, COUNT(*) AS n FROM dbo.[PROCEDURE]
       WHERE audit_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ',')) GROUP BY state`,
      { ids: auditoriaIds.join(",") },
    );
    for (const f of filas) if (f.estado in conteo) conteo[f.estado] = f.n;
    return conteo;
  }

  async evidencias(auditoriaId: number) {
    const filas = await this.db.consulta<Fila>(
      `
      WITH directas AS (
        SELECT e.* FROM dbo.EVIDENCE e
         WHERE e.deleted = 0 AND (e.procedure_id IN (SELECT procedure_id FROM dbo.[PROCEDURE] WHERE audit_id = @id)
                               OR e.finding_id IN (SELECT finding_id FROM dbo.FINDING WHERE audit_id = @id))
      ), todas AS (
        SELECT * FROM directas
        UNION ALL
        SELECT e.* FROM dbo.EVIDENCE e WHERE e.deleted = 0 AND e.parent_id IN (SELECT evidence_id FROM directas)
      )
      SELECT t.evidence_id AS id, t.tracking_id, t.parent_id AS evidencia_padre_id, t.procedure_id AS procedimiento_id,
             t.request_pbc_id AS solicitud_pbc_id, t.finding_id AS hallazgo_id, t.file_name AS nombre_archivo, t.blob_url,
             t.mime_type AS tipo_mime, t.size_bytes AS tamano_bytes, t.sha256 AS hash_sha256, t.uploaded_by AS cargado_por_id,
             t.uploaded_at AS fecha_carga, t.deleted AS eliminado, COALESCE(u.full_name, '') AS cargado_por
        FROM todas t LEFT JOIN dbo.[USER] u ON u.user_id = t.uploaded_by
       ORDER BY t.tracking_id`,
      { id: auditoriaId },
    );
    return filas.map((f) => ({ ...f, tamano_bytes: num(f.tamano_bytes) }) as unknown as EvidenciaVista);
  }
}

// ---------- Hallazgos ----------

const SQL_HALLAZGO = `
  SELECT f.finding_id AS id, f.tracking_id, f.audit_id AS auditoria_id, f.procedure_id AS procedimiento_id, f.title AS titulo,
         f.condition AS condicion, f.criteria AS criterio, f.cause AS causa, f.effect AS efecto, f.recommendation AS recomendacion,
         f.severity AS severidad, f.finding_type AS tipo, f.residual_risk AS riesgo_residual, f.impact_mxn AS impacto_mxn, f.state AS estado,
         f.responsible_id AS responsable_id, f.identified_at AS fecha_identificacion,
         a.tracking_id AS auditoria_folio, a.name AS auditoria, bu.unity AS unidad, bu.area, bu.business_unit_id AS unidad_negocio_id,
         bu.direction AS direccion, u.full_name AS responsable,
         (SELECT COUNT(*) FROM dbo.REMEDIATION_PLAN rp WHERE rp.finding_id = f.finding_id) AS planes,
         CAST(CASE WHEN EXISTS (
           SELECT 1 FROM dbo.AUDIT_LOG al
            WHERE al.entity = 'sugerencias_ia' AND al.action = 'ACTUALIZAR'
              AND al.detail LIKE '%"hallazgo":"' + f.tracking_id + '"%'
         ) THEN 1 ELSE 0 END AS bit) AS origen_ia
    FROM dbo.FINDING f
    JOIN dbo.AUDIT a ON a.audit_id = f.audit_id
    JOIN dbo.BUSINESS_UNIT bu ON bu.business_unit_id = a.business_unit_id
    LEFT JOIN dbo.[USER] u ON u.user_id = f.responsible_id
   WHERE f.tracking_id IS NOT NULL`;

const hallazgoVista = (f: Fila) =>
  ({ ...f, impacto_mxn: num(f.impacto_mxn), origen_ia: Boolean(f.origen_ia) }) as unknown as HallazgoVista;

@Injectable()
export class HallazgosSqlRepository extends HallazgosRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async listar() {
    const orden = { Crítica: 0, Alta: 1, Moderada: 2, Baja: 3 };
    return (await this.db.consulta<Fila>(SQL_HALLAZGO))
      .map(hallazgoVista)
      .sort(
        (x, y) =>
          orden[x.severidad] - orden[y.severidad] ||
          y.fecha_identificacion.getTime() - x.fecha_identificacion.getTime(),
      );
  }

  async porAuditoria(auditoriaId: number) {
    return (
      await this.db.consulta<Fila>(`${SQL_HALLAZGO} AND f.audit_id = @auditoriaId ORDER BY f.finding_id`, {
        auditoriaId,
      })
    ).map(hallazgoVista);
  }

  async crear(d: NuevoHallazgo) {
    return this.db.transaccion(async (tx) => {
      const [a] = await tx.consulta<{ estado: string }>("SELECT state AS estado FROM dbo.AUDIT WHERE audit_id = @id", {
        id: d.auditoria_id,
      });
      if (a?.estado === "cerrada") throw new ConflictException("Expediente cerrado: el hallazgo es de solo lectura.");
      const tracking_id = await siguienteFolio(tx, "FINDING", "FND");
      const fecha = segundos();
      const [r] = await tx.consulta<{ id: number }>(
        `
        INSERT INTO dbo.FINDING (severity, state, audit_id, tracking_id, procedure_id, title, condition, criteria, cause, effect, recommendation,
                                 finding_type, impact_mxn, identified_at)
        OUTPUT INSERTED.finding_id AS id
        VALUES (@severidad, 'abierto', @auditoria, @tracking_id, @procedimiento, @titulo, @condicion, @criterio, @causa, @efecto, @recomendacion,
                @tipo, @impacto, @fecha)`,
        {
          severidad: d.severidad,
          auditoria: d.auditoria_id,
          tracking_id,
          procedimiento: d.procedimiento_id,
          titulo: d.titulo,
          condicion: d.condicion,
          criterio: d.criterio,
          causa: d.causa,
          efecto: d.efecto,
          recomendacion: d.recomendacion,
          tipo: d.tipo,
          impacto: d.impacto_mxn,
          fecha,
        },
      );
      return {
        ...d,
        id: r.id,
        tracking_id,
        estado: "abierto",
        riesgo_residual: null,
        responsable_id: null,
        fecha_identificacion: fecha,
      } satisfies Hallazgo;
    });
  }

  async cambiarEstado(id: number, estado: Hallazgo["estado"]) {
    await this.db.consulta("UPDATE dbo.FINDING SET state = @estado WHERE finding_id = @id", { id, estado });
  }

  async procedimientoPerteneceA(procedimientoId: number, auditoriaId: number) {
    const r = await this.db.consulta("SELECT 1 AS si FROM dbo.[PROCEDURE] WHERE procedure_id = @p AND audit_id = @a", {
      p: procedimientoId,
      a: auditoriaId,
    });
    return r.length > 0;
  }

  async marcarProcedimientoConHallazgo(procedimientoId: number) {
    await this.db.consulta("UPDATE dbo.[PROCEDURE] SET applies_finding = 1 WHERE procedure_id = @id", {
      id: procedimientoId,
    });
  }
}

// ---------- Planes de remediación ----------

const SQL_PLAN = `
  SELECT rp.remediation_plan_id AS id, rp.tracking_id, rp.finding_id AS hallazgo_id, rp.description AS descripcion,
         rp.responsible_id AS responsable_id, rp.due_date AS fecha_compromiso, rp.amount_mxn AS monto_mxn, rp.state AS estado,
         rp.progress_pct AS avance_pct, rp.concluded_at AS fecha_conclusion, COALESCE(u.full_name, '') AS responsable,
         f.tracking_id AS hallazgo_folio, f.title AS hallazgo, f.severity AS severidad, a.audit_id AS auditoria_id,
         a.tracking_id AS auditoria_folio, a.name AS auditoria, bu.unity AS unidad, bu.time_zone AS zona_horaria,
         bu.business_unit_id AS unidad_negocio_id, bu.direction AS direccion
    FROM dbo.REMEDIATION_PLAN rp
    JOIN dbo.FINDING f ON f.finding_id = rp.finding_id
    JOIN dbo.AUDIT a ON a.audit_id = f.audit_id
    JOIN dbo.BUSINESS_UNIT bu ON bu.business_unit_id = a.business_unit_id
    LEFT JOIN dbo.[USER] u ON u.user_id = rp.responsible_id
   WHERE rp.tracking_id IS NOT NULL`;

const planVista = (f: Fila) => ({ ...f, monto_mxn: num(f.monto_mxn) }) as unknown as PlanVista;

const SQL_AVANCE = `
  SELECT pp.plan_progress_id AS id, pp.remediation_plan_id AS plan_id, pp.progress_pct AS avance_pct, pp.comment AS comentario,
         pp.evidence_id AS evidencia_id, pp.updated_by AS actualizado_por_id, pp.progress_date AS fecha, pp.time_zone AS zona_horaria`;

async function insertarAvance(tx: Ejecutor, a: Omit<Avance, "id" | "fecha">, fecha = new Date()) {
  const [r] = await tx.consulta<{ id: number }>(
    `
    INSERT INTO dbo.PLAN_PROGRESS (progress_date, remediation_plan_id, progress_pct, comment, evidence_id, updated_by, time_zone)
    OUTPUT INSERTED.plan_progress_id AS id
    VALUES (@fecha, @plan, @avance, @comentario, @evidencia, @usuario, @zona)`,
    {
      fecha,
      plan: a.plan_id,
      avance: a.avance_pct,
      comentario: a.comentario,
      evidencia: a.evidencia_id,
      usuario: a.actualizado_por_id,
      zona: a.zona_horaria,
    },
  );
  return { ...a, id: r.id, fecha } satisfies Avance;
}

@Injectable()
export class PlanesSqlRepository extends PlanesRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async listar() {
    return (await this.db.consulta<Fila>(`${SQL_PLAN} ORDER BY rp.due_date`)).map(planVista);
  }

  async buscar(id: number) {
    const [f] = await this.db.consulta<Fila>(`${SQL_PLAN} AND rp.remediation_plan_id = @id`, { id });
    return f ? planVista(f) : null;
  }

  /** HU_09: la asignación notifica al responsable en la misma operación. */
  async crear(d: Omit<Plan, "id" | "tracking_id">) {
    return this.db.transaccion(async (tx) => {
      const tracking_id = await siguienteFolio(tx, "REMEDIATION_PLAN", "RP");
      const [r] = await tx.consulta<{ id: number }>(
        `
        INSERT INTO dbo.REMEDIATION_PLAN (progress_pct, state, finding_id, tracking_id, description, responsible_id, due_date, amount_mxn, concluded_at)
        OUTPUT INSERTED.remediation_plan_id AS id
        VALUES (@avance, @estado, @hallazgo, @tracking_id, @descripcion, @responsable, @compromiso, @monto, @conclusion)`,
        {
          avance: d.avance_pct,
          estado: d.estado,
          hallazgo: d.hallazgo_id,
          tracking_id,
          descripcion: d.descripcion,
          responsable: d.responsable_id,
          compromiso: d.fecha_compromiso,
          monto: d.monto_mxn,
          conclusion: d.fecha_conclusion,
        },
      );
      await tx.consulta(
        `
        INSERT INTO dbo.NOTIFICATION (type, remediation_plan_id, user_id, message, channel, sent_at)
        VALUES ('PLAN_ASIGNADO', @plan, @usuario, @mensaje, 'plataforma', SYSUTCDATETIME())`,
        {
          plan: r.id,
          usuario: d.responsable_id,
          mensaje: `Se te ha asignado el plan ${tracking_id}: ${d.descripcion}`.slice(0, 500),
        },
      );
      return { ...d, id: r.id, tracking_id } satisfies Plan;
    });
  }

  async actualizar(id: number, cambios: Partial<Pick<Plan, "estado" | "avance_pct" | "fecha_conclusion">>) {
    const columnas = { estado: "state", avance_pct: "progress_pct", fecha_conclusion: "concluded_at" } as const;
    const sets = (Object.keys(cambios) as (keyof typeof columnas)[]).map((k) => `${columnas[k]} = @${k}`);
    if (!sets.length) return;
    await this.db.consulta(`UPDATE dbo.REMEDIATION_PLAN SET ${sets.join(", ")} WHERE remediation_plan_id = @id`, {
      id,
      ...cambios,
    });
  }

  async registrarAvance(avance: Omit<Avance, "id" | "fecha">) {
    return this.db.transaccion((tx) => insertarAvance(tx, avance));
  }

  async avances(planId: number) {
    return this.db.consulta<Avance & { usuario: string }>(
      `
      ${SQL_AVANCE}, COALESCE(u.full_name, '') AS usuario
        FROM dbo.PLAN_PROGRESS pp LEFT JOIN dbo.[USER] u ON u.user_id = pp.updated_by
       WHERE pp.remediation_plan_id = @planId ORDER BY pp.progress_date DESC`,
      { planId },
    );
  }

  async validar(
    id: number,
    estadoEsperado: Plan["estado"],
    decision: "aprobado" | "rechazado",
    comentario: string | null,
    usuario: UsuarioSesion,
    zonaHoraria: string,
    ip: string | null,
  ) {
    await this.db.transaccion(async (tx) => {
      const [p] = await tx.consulta<{ estado: Plan["estado"]; avance: number; folio: string; hallazgo: number }>(
        `
        SELECT state AS estado, progress_pct AS avance, tracking_id AS folio, finding_id AS hallazgo
          FROM dbo.REMEDIATION_PLAN WITH (UPDLOCK, ROWLOCK) WHERE remediation_plan_id = @id`,
        { id },
      );
      if (!p || p.estado !== estadoEsperado)
        throw new ConflictException("El plan cambió de estado o ya fue validado; consulta su estado actual.");
      const fecha = new Date();
      const etapa = estadoEsperado === "revision_grc" ? "grc" : "jefatura";
      const estado: Plan["estado"] =
        decision === "rechazado" ? "en_progreso" : etapa === "grc" ? "revision_jefe" : "cerrado";
      await tx.consulta(
        `
        UPDATE dbo.REMEDIATION_PLAN
           SET state = @estado, concluded_at = CASE WHEN @estado = 'cerrado' THEN @fecha WHEN @rechazado = 1 THEN NULL ELSE concluded_at END
         WHERE remediation_plan_id = @id`,
        { id, estado, fecha, rechazado: decision === "rechazado" },
      );
      if (estado === "cerrado") {
        await tx.consulta(
          `
          UPDATE dbo.FINDING SET state = 'solventado'
           WHERE finding_id = @hallazgo
             AND NOT EXISTS (SELECT 1 FROM dbo.REMEDIATION_PLAN WHERE finding_id = @hallazgo AND state <> 'cerrado')`,
          { hallazgo: p.hallazgo },
        );
      }
      await insertarAvance(
        tx,
        {
          plan_id: id,
          avance_pct: p.avance,
          comentario: comentario ?? `Validación ${etapa}: aprobado.`,
          evidencia_id: null,
          actualizado_por_id: usuario.id,
          zona_horaria: zonaHoraria,
        },
        fecha,
      );
      await tx.consulta(
        `
        INSERT INTO dbo.AUDIT_LOG (entity, entity_id, tracking_id, action, user_id, detail, ip, time_zone, created_at)
        VALUES ('planes', @id, @folio, 'VALIDACION', @usuario, @detalle, @ip, @zona, @fecha)`,
        {
          id,
          folio: p.folio,
          usuario: usuario.id,
          ip,
          zona: zonaHoraria,
          fecha,
          detalle: JSON.stringify({ etapa, decision, comentario, estado_resultante: estado }),
        },
      );
    });
  }

  async hallazgosSinPlan(auditoriaId: number) {
    return this.db.consulta<{ id: number; tracking_id: string; titulo: string }>(
      `
      SELECT f.finding_id AS id, f.tracking_id, f.title AS titulo FROM dbo.FINDING f
       WHERE f.audit_id = @auditoriaId AND NOT EXISTS (SELECT 1 FROM dbo.REMEDIATION_PLAN rp WHERE rp.finding_id = f.finding_id)`,
      { auditoriaId },
    );
  }
}

// ---------- Cierre ----------

@Injectable()
export class CierreSqlRepository extends CierreRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async aprobaciones(auditoriaId: number) {
    return this.db.consulta<AprobacionVista>(
      `
      SELECT ap.approval_id AS id, ap.audit_id AS auditoria_id, ap.sequence AS secuencia, ap.approval_level AS nivel, ap.approver_id AS aprobador_id,
             ap.decision, ap.comments AS comentarios, ap.decided_at AS fecha_decision, ap.time_zone AS zona_horaria, u.full_name AS aprobador
        FROM dbo.APPROVAL ap LEFT JOIN dbo.[USER] u ON u.user_id = ap.approver_id
       WHERE ap.audit_id = @auditoriaId ORDER BY ap.sequence`,
      { auditoriaId },
    );
  }

  async iniciarRonda(auditoriaId: number, niveles: NivelAprobacion[]) {
    await this.db.transaccion(async (tx) => {
      await tx.consulta("DELETE FROM dbo.APPROVAL WHERE audit_id = @auditoriaId", { auditoriaId });
      for (const [i, nivel] of niveles.entries()) {
        await tx.consulta(
          `INSERT INTO dbo.APPROVAL (approval_level, decision, audit_id, sequence) VALUES (@nivel, 'pendiente', @auditoriaId, @secuencia)`,
          { nivel, auditoriaId, secuencia: i + 1 },
        );
      }
    });
  }

  async registrarDecision(
    aprobacionId: number,
    c: Pick<Aprobacion, "decision" | "aprobador_id" | "comentarios" | "zona_horaria">,
  ) {
    await this.db.consulta(
      `
      UPDATE dbo.APPROVAL SET decision = @decision, approver_id = @aprobador, comments = @comentarios, time_zone = @zona, decided_at = @fecha
       WHERE approval_id = @id`,
      {
        id: aprobacionId,
        decision: c.decision,
        aprobador: c.aprobador_id,
        comentarios: c.comentarios,
        zona: c.zona_horaria,
        fecha: segundos(),
      },
    );
  }

  async cierre(auditoriaId: number) {
    const [c] = await this.db.consulta<Cierre>(
      `
      SELECT audit_closure_id AS id, audit_id AS auditoria_id, closed_by AS cerrado_por_id, sealed_at AS sello_temporal, algorithm AS algoritmo,
             integrity_hash AS hash_integridad, manifest AS manifiesto, signature AS firma
        FROM dbo.AUDIT_CLOSURE WHERE audit_id = @auditoriaId`,
      { auditoriaId },
    );
    return c ?? null;
  }

  async guardarCierre(c: Omit<Cierre, "id">) {
    await this.db.transaccion(async (tx) => {
      const existe = await tx.consulta(
        "SELECT 1 AS si FROM dbo.AUDIT_CLOSURE WITH (UPDLOCK, HOLDLOCK) WHERE audit_id = @id",
        { id: c.auditoria_id },
      );
      if (existe.length) throw new ConflictException("El sello de cierre es inmutable.");
      await tx.consulta(
        `
        INSERT INTO dbo.AUDIT_CLOSURE (integrity_hash, blocked, audit_id, closed_by, sealed_at, algorithm, manifest, signature)
        VALUES (@hash, 1, @auditoria, @cerradoPor, @sello, @algoritmo, @manifiesto, @firma)`,
        {
          hash: c.hash_integridad,
          auditoria: c.auditoria_id,
          cerradoPor: c.cerrado_por_id,
          sello: c.sello_temporal,
          algoritmo: c.algoritmo,
          manifiesto: c.manifiesto,
          firma: c.firma,
        },
      );
    });
  }

  async notificar(usuarioId: number, auditoriaId: number, tipo: string, mensaje: string) {
    await this.db.consulta(
      `
      INSERT INTO dbo.NOTIFICATION (type, user_id, audit_id, message, channel, sent_at)
      VALUES (@tipo, @usuario, @auditoria, @mensaje, 'plataforma', SYSUTCDATETIME())`,
      { tipo, usuario: usuarioId, auditoria: auditoriaId, mensaje: mensaje.slice(0, 500) },
    );
  }
}

// ---------- Bitácora (HU_15) ----------

@Injectable()
export class BitacoraSqlRepository extends BitacoraRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async agregarOperacion(d: NuevaOperacion) {
    const [r] = await this.db.consulta<{ id: number; fecha: Date }>(
      `
      INSERT INTO dbo.AUDIT_LOG (entity, entity_id, tracking_id, action, user_id, detail, ip, time_zone)
      OUTPUT INSERTED.audit_log_id AS id, INSERTED.created_at AS fecha
      VALUES (@entidad, @entidadId, @folio, @accion, @usuario, @detalle, @ip, @zona)`,
      {
        entidad: d.entidad,
        entidadId: d.entidad_id,
        folio: d.folio,
        accion: d.accion,
        usuario: d.usuario_id,
        detalle: d.detalle,
        ip: d.ip,
        zona: d.zona_horaria,
      },
    );
    return { ...d, ...r } satisfies RegistroBitacora;
  }

  async agregarAcceso(d: NuevoAcceso) {
    const [r] = await this.db.consulta<{ id: number; fecha: Date }>(
      `
      INSERT INTO dbo.ACCESS_LOG (user_id, email, result, ip, user_agent, time_zone)
      OUTPUT INSERTED.access_log_id AS id, INSERTED.created_at AS fecha
      VALUES (@usuario, @correo, @resultado, @ip, @agente, @zona)`,
      {
        usuario: d.usuario_id,
        correo: d.correo,
        resultado: d.resultado,
        ip: d.ip,
        agente: d.agente?.slice(0, 300) ?? null,
        zona: d.zona_horaria,
      },
    );
    return { ...d, ...r } satisfies Acceso;
  }

  /** FE1S-36 · Cada movimiento se liga a su auditoría según la entidad que tocó, para filtrar y agrupar. */
  async operaciones(f: FiltrosOperaciones): Promise<Pagina<OperacionVista>> {
    const p: Record<string, unknown> = { limiteFecha: f.limiteFecha, inicio: f.inicio, limite: f.limite };
    const donde: string[] = ["o.created_at >= @limiteFecha"];
    if (f.desde) {
      donde.push("o.created_at >= @desde");
      p.desde = f.desde;
    }
    if (f.hasta) {
      donde.push("o.created_at <= @hasta");
      p.hasta = f.hasta;
    }
    if (f.usuarioId) {
      donde.push("o.user_id = @usuarioId");
      p.usuarioId = f.usuarioId;
    }
    if (f.accion) {
      donde.push("o.action = @accion");
      p.accion = f.accion;
    }
    if (f.entidad) {
      donde.push("o.entity = @entidad");
      p.entidad = f.entidad;
    }
    if (f.auditoriaId) {
      donde.push("o.auditoria_id = @auditoriaId");
      p.auditoriaId = f.auditoriaId;
    }
    if (f.texto?.trim()) {
      donde.push(
        "(o.tracking_id LIKE @texto OR u.full_name LIKE @texto OR a.tracking_id LIKE @texto OR a.name LIKE @texto)",
      );
      p.texto = `%${f.texto.trim()}%`;
    }
    const filas = await this.db.consulta<OperacionVista & { total: number }>(
      `
      WITH ops AS (
        SELECT l.*, CASE l.entity
          WHEN 'auditorias' THEN l.entity_id
          WHEN 'hallazgos' THEN (SELECT f.audit_id FROM dbo.FINDING f WHERE f.finding_id = l.entity_id)
          WHEN 'planes' THEN (SELECT f.audit_id FROM dbo.REMEDIATION_PLAN rp JOIN dbo.FINDING f ON f.finding_id = rp.finding_id WHERE rp.remediation_plan_id = l.entity_id)
          WHEN 'evidencias' THEN (SELECT pr.audit_id FROM dbo.EVIDENCE e JOIN dbo.[PROCEDURE] pr ON pr.procedure_id = e.procedure_id WHERE e.evidence_id = l.entity_id)
          WHEN 'procedimientos_auditoria' THEN (SELECT pr.audit_id FROM dbo.[PROCEDURE] pr WHERE pr.procedure_id = l.entity_id)
          WHEN 'solicitudes_pbc' THEN (SELECT pr.audit_id FROM dbo.REQUEST_PBC r JOIN dbo.[PROCEDURE] pr ON pr.procedure_id = r.procedure_id WHERE r.request_pbc_id = l.entity_id)
          WHEN 'lotes' THEN (SELECT lo.audit_id FROM dbo.IA_LOTE lo WHERE lo.lote_id = l.entity_id)
          WHEN 'aprobaciones' THEN (SELECT ap.audit_id FROM dbo.APPROVAL ap WHERE ap.approval_id = l.entity_id)
          WHEN 'sugerencias_ia' THEN CASE WHEN l.action = 'CREAR' THEN l.entity_id ELSE (SELECT ia.audit_id FROM dbo.IA_ANALYSIS ia WHERE ia.analysis_id = l.entity_id / 1000) END
        END AS auditoria_id
        FROM dbo.AUDIT_LOG l
      )
      SELECT o.audit_log_id AS id, o.entity AS entidad, o.entity_id AS entidad_id, o.tracking_id AS folio, o.action AS accion, o.user_id AS usuario_id,
             o.detail AS detalle, o.ip, o.time_zone AS zona_horaria, o.created_at AS fecha, u.full_name AS usuario, r.code AS rol,
             o.auditoria_id, a.tracking_id AS auditoria_folio, a.name AS auditoria, COUNT(*) OVER () AS total
        FROM ops o
        LEFT JOIN dbo.[USER] u ON u.user_id = o.user_id
        LEFT JOIN dbo.[ROLE] r ON r.role_id = u.role_id
        LEFT JOIN dbo.AUDIT a ON a.audit_id = o.auditoria_id
       WHERE ${donde.join(" AND ")}
       ORDER BY o.created_at DESC, o.audit_log_id DESC
      OFFSET @inicio ROWS FETCH NEXT @limite ROWS ONLY`,
      p,
    );
    return {
      filas: filas.map(({ total: _t, ...f }) => f),
      total: filas[0]?.total ?? (f.inicio ? await this.contarOperaciones(f) : 0),
    };
  }

  /** Solo cuando se pide una página más allá del final: COUNT(*) OVER () no regresa filas que leer. */
  private async contarOperaciones(f: FiltrosOperaciones): Promise<number> {
    return (await this.operaciones({ ...f, inicio: 0, limite: 1 })).total;
  }

  async accesos(f: FiltrosAccesos) {
    const p: Record<string, unknown> = { limiteFecha: f.limiteFecha, inicio: f.inicio, limite: f.limite };
    const donde: string[] = ["l.created_at >= @limiteFecha"];
    if (f.desde) {
      donde.push("l.created_at >= @desde");
      p.desde = f.desde;
    }
    if (f.hasta) {
      donde.push("l.created_at <= @hasta");
      p.hasta = f.hasta;
    }
    if (f.usuarioId) {
      donde.push("l.user_id = @usuarioId");
      p.usuarioId = f.usuarioId;
    }
    if (f.resultado) {
      donde.push("l.result = @resultado");
      p.resultado = f.resultado;
    }
    if (f.texto?.trim()) {
      donde.push("(u.full_name LIKE @texto OR l.email LIKE @texto OR l.ip LIKE @texto)");
      p.texto = `%${f.texto.trim()}%`;
    }
    const filas = await this.db.consulta<AccesoVista & { total: number }>(
      `
      SELECT l.access_log_id AS id, l.user_id AS usuario_id, l.email AS correo, l.result AS resultado, l.ip, l.user_agent AS agente,
             l.time_zone AS zona_horaria, l.created_at AS fecha, u.full_name AS usuario, r.code AS rol, COUNT(*) OVER () AS total
        FROM dbo.ACCESS_LOG l
        LEFT JOIN dbo.[USER] u ON u.user_id = l.user_id
        LEFT JOIN dbo.[ROLE] r ON r.role_id = u.role_id
       WHERE ${donde.join(" AND ")}
       ORDER BY l.created_at DESC, l.access_log_id DESC
      OFFSET @inicio ROWS FETCH NEXT @limite ROWS ONLY`,
      p,
    );
    return { filas: filas.map(({ total: _t, ...f }) => f), total: filas[0]?.total ?? 0 };
  }
}

// ---------- Estado de la conexión (health) ----------

@Injectable()
export class EstadoDatosSql extends EstadoDatos {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async estado() {
    const [r] = await this.db.consulta<{ base: string; edicion: string; tablas: number }>(`
      SELECT DB_NAME() AS base, CAST(SERVERPROPERTY('Edition') AS NVARCHAR(100)) AS edicion,
             (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE') AS tablas`);
    const azure = (process.env.DB_HOST ?? "").endsWith(".database.windows.net");
    return { motor: azure ? "Azure SQL" : "SQL Server", base: r.base, edicion: r.edicion, tablas: r.tablas };
  }
}
