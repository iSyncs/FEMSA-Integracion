import "../../entorno";
import { BaseDeDatosMemoria } from "../memoria/base-de-datos-memoria";
import { ConexionSql, Ejecutor, siguienteFolio } from "./conexion-sql";

/**
 * Carga los datos de demostración (los mismos de la API en memoria) en la base SQL.
 * Uso: npm run db:seed            -> solo si las tablas del Equipo 12 están vacías
 *      npm run db:seed -- --reiniciar -> borra primero SOLO los datos del Equipo 12
 * Nunca toca filas de otros equipos: sus roles no tienen `code` y sus usuarios no usan @demo.femsa.test.
 */
const DOMINIO_DEMO = "%@demo.femsa.test";

async function asegurarEvidenciasIaDemo(tx: Ejecutor) {
  const [destino] = await tx.consulta<{ procedimiento: number; usuario: number }>(`
    SELECT TOP 1 p.procedure_id AS procedimiento, a.user_id AS usuario
      FROM dbo.AUDIT a
      JOIN dbo.[PROCEDURE] p ON p.audit_id = a.audit_id
     WHERE a.tracking_id = 'AUD-000008'
     ORDER BY p.procedure_id`);
  if (!destino) return 0;

  const archivos = [
    ["acta_arqueo_tienda_1842.pdf", 2803, "e20799ddaec8c99bf333cbf5d337ab4828f7f6044acc6fc3fd85bacfb06711dc"],
    ["acta_arqueo_completa_1842.pdf", 6156, "306474cb2f9367e393e290477d2be6ab16a88d117194535288aef816e2584aeb"],
    ["acta_arqueo_parcial_1842.pdf", 3292, "ec4c3728067300747651f624a1f63360701f8eee14769ba1c6579645dc05521b"],
  ] as const;
  let agregadas = 0;
  for (const [nombre, tamano, hash] of archivos) {
    const [existente] = await tx.consulta<{ id: number }>(
      `
      SELECT TOP 1 evidence_id AS id FROM dbo.EVIDENCE
       WHERE file_name = @nombre AND deleted = 0`,
      { nombre },
    );
    if (existente) continue;
    const tracking = await siguienteFolio(tx, "EVIDENCE", "SOPORTE");
    await tx.consulta(
      `
      INSERT INTO dbo.EVIDENCE
        (tracking_id, procedure_id, file_name, blob_url, mime_type, size_bytes, sha256, uploaded_by, deleted)
      VALUES
        (@tracking, @procedimiento, @nombre, @blob, 'application/pdf', @tamano, @hash, @usuario, 0)`,
      {
        tracking,
        procedimiento: destino.procedimiento,
        nombre,
        blob: `demo://${nombre}`,
        tamano,
        hash,
        usuario: destino.usuario,
      },
    );
    agregadas += 1;
  }
  return agregadas;
}

async function insertar(tx: Ejecutor, tabla: string, pk: string, fila: Record<string, unknown>) {
  const columnas = Object.keys(fila);
  const [r] = await tx.consulta<{ id: number }>(
    `INSERT INTO dbo.[${tabla}] (${columnas.map((c) => `[${c}]`).join(", ")}) OUTPUT INSERTED.[${pk}] AS id
     VALUES (${columnas.map((c) => `@${c}`).join(", ")})`,
    fila,
  );
  return r.id;
}

async function reiniciar(tx: Ejecutor) {
  await tx.consulta(
    `
    SET XACT_ABORT ON;
    DELETE FROM dbo.AUDIT_LOG;
    DELETE FROM dbo.ACCESS_LOG;
    IF OBJECT_ID('dbo.IA_LOTE_EVIDENCE') IS NOT NULL DELETE FROM dbo.IA_LOTE_EVIDENCE;
    IF OBJECT_ID('dbo.IA_LOTE') IS NOT NULL DELETE FROM dbo.IA_LOTE;
    IF OBJECT_ID('dbo.IA_ANALYSIS') IS NOT NULL DELETE FROM dbo.IA_ANALYSIS;
    DELETE FROM dbo.NOTIFICATION;
    DELETE FROM dbo.PLAN_PROGRESS;
    UPDATE dbo.EVIDENCE SET parent_id = NULL;
    DELETE FROM dbo.EVIDENCE;
    DELETE FROM dbo.REMEDIATION_PLAN;
    DELETE FROM dbo.EXEMPTION_REQUEST;
    IF OBJECT_ID('dbo.REQUEST_PBC_ITEM') IS NOT NULL DELETE FROM dbo.REQUEST_PBC_ITEM;
    DELETE FROM dbo.REQUEST_PBC;
    DELETE FROM dbo.AUDIT_CLOSURE;
    DELETE FROM dbo.APPROVAL;
    UPDATE dbo.[PROCEDURE] SET finding_id = NULL;
    UPDATE dbo.FINDING SET procedure_id = NULL;
    DELETE FROM dbo.FINDING;
    DELETE FROM dbo.[PROCEDURE];
    DELETE FROM dbo.AUDIT_PARTICIPANT;
    DELETE FROM dbo.CONTROL;
    DELETE FROM dbo.RISK;
    UPDATE dbo.BUSINESS_UNIT SET audit_id = NULL WHERE code IS NOT NULL;
    DELETE FROM dbo.AUDIT;
    DELETE FROM dbo.[USER] WHERE email LIKE @dominio;
    DELETE FROM dbo.BUSINESS_UNIT WHERE code IS NOT NULL;
    DELETE FROM dbo.[ROLE] WHERE code IS NOT NULL;`,
    { dominio: DOMINIO_DEMO },
  );
  // Los folios y los id vuelven a empezar en 1 (solo tablas del Equipo 12 que quedaron vacías).
  for (const t of TABLAS_EQ12) {
    await tx.consulta(
      `IF NOT EXISTS (SELECT 1 FROM dbo.[${t}]) DBCC CHECKIDENT ('dbo.${t}', RESEED, 0) WITH NO_INFOMSGS;`,
    );
  }
}

const TABLAS_EQ12 = [
  "AUDIT",
  "BUSINESS_UNIT",
  "RISK",
  "CONTROL",
  "PROCEDURE",
  "FINDING",
  "EVIDENCE",
  "APPROVAL",
  "AUDIT_CLOSURE",
  "REMEDIATION_PLAN",
  "PLAN_PROGRESS",
  "NOTIFICATION",
  "AUDIT_LOG",
  "ACCESS_LOG",
  "REQUEST_PBC",
  "REQUEST_PBC_ITEM",
];

async function sembrar(tx: Ejecutor, m: BaseDeDatosMemoria) {
  const rol = new Map<number, number>();
  for (const r of m.roles)
    rol.set(r.id, await insertar(tx, "ROLE", "role_id", { code: r.clave, name: r.nombre, description: r.descripcion }));

  const unidad = new Map<number, number>();
  for (const u of m.unidades) {
    unidad.set(
      u.id,
      await insertar(tx, "BUSINESS_UNIT", "business_unit_id", {
        unity: u.unidad,
        country: u.pais,
        code: u.clave,
        direction: u.direccion,
        division: u.division,
        area: u.area,
        time_zone: u.zona_horaria,
      }),
    );
  }

  const usuario = new Map<number, number>();
  for (const u of m.usuarios) {
    const [r] = await tx.consulta<{ id: number }>(
      `
      INSERT INTO dbo.[USER] (entra_id, email, full_name, is_active, role_id, direction, business_unit_id, time_zone)
      OUTPUT INSERTED.user_id AS id VALUES (NEWID(), @email, @nombre, @activo, @rol, @direccion, @unidad, @zona)`,
      {
        email: u.correo,
        nombre: u.nombre,
        activo: u.activo,
        rol: rol.get(u.rol_id),
        direccion: u.direccion,
        unidad: u.unidad_negocio_id ? unidad.get(u.unidad_negocio_id) : null,
        zona: u.zona_horaria,
      },
    );
    usuario.set(u.id, r.id);
  }
  const U = (id: number | null) => (id == null ? null : (usuario.get(id) ?? null));

  const riesgo = new Map<number, number>();
  for (const r of m.riesgos) {
    riesgo.set(
      r.id,
      await insertar(tx, "RISK", "risk_id", {
        tracking_id: r.tracking_id,
        name: r.nombre,
        category: r.categoria,
        inherent_level: r.nivel_inherente,
      }),
    );
  }
  const control = new Map<number, number>();
  for (const c of m.controles) {
    const r = m.riesgos.find((x) => x.id === c.riesgo_id)!;
    control.set(
      c.id,
      await insertar(tx, "CONTROL", "control_id", {
        tracking_id: c.tracking_id,
        associated_risk: r.tracking_id,
        name: c.nombre,
        domain: c.dominio,
        risk_id: riesgo.get(c.riesgo_id),
      }),
    );
  }

  const auditoria = new Map<number, number>();
  for (const a of m.auditorias) {
    auditoria.set(
      a.id,
      await insertar(tx, "AUDIT", "audit_id", {
        tracking_id: a.tracking_id,
        state: a.estado,
        user_id: U(a.lider_id),
        name: a.nombre,
        objective: a.objetivo,
        business_unit_id: unidad.get(a.unidad_negocio_id),
        audit_type: a.tipo,
        area: a.area,
        priority: a.prioridad,
        start_date: a.fecha_inicio,
        end_date: a.fecha_fin,
        created_at: a.creado_en,
      }),
    );
  }
  for (const p of m.participantes) {
    await tx.consulta("INSERT INTO dbo.AUDIT_PARTICIPANT (audit_id, user_id, role_in_audit) VALUES (@a, @u, @papel)", {
      a: auditoria.get(p.auditoria_id),
      u: U(p.usuario_id),
      papel: p.papel,
    });
  }

  const procedimiento = new Map<number, number>();
  for (const p of m.procedimientos) {
    procedimiento.set(
      p.id,
      await insertar(tx, "PROCEDURE", "procedure_id", {
        effectiveness_rating: p.calif_efectividad,
        audit_id: auditoria.get(p.auditoria_id),
        control_id: control.get(p.control_id),
        tracking_id: p.tracking_id,
        auditor_id: U(p.auditor_id),
        state: p.estado,
        design_rating: p.calif_diseno,
        vulnerability: p.vulnerabilidad,
        applies_finding: p.aplica_hallazgo,
        comments: p.comentarios,
        evaluated_at: p.fecha_evaluacion,
      }),
    );
  }

  const hallazgo = new Map<number, number>();
  for (const h of m.hallazgos) {
    hallazgo.set(
      h.id,
      await insertar(tx, "FINDING", "finding_id", {
        severity: h.severidad,
        state: h.estado,
        audit_id: auditoria.get(h.auditoria_id),
        tracking_id: h.tracking_id,
        procedure_id: h.procedimiento_id ? procedimiento.get(h.procedimiento_id) : null,
        title: h.titulo,
        condition: h.condicion,
        criteria: h.criterio,
        cause: h.causa,
        effect: h.efecto,
        recommendation: h.recomendacion,
        finding_type: h.tipo,
        residual_risk: h.riesgo_residual,
        impact_mxn: h.impacto_mxn,
        responsible_id: U(h.responsable_id),
        identified_at: h.fecha_identificacion,
      }),
    );
  }

  const evidencia = new Map<number, number>();
  for (const e of m.evidencias) {
    evidencia.set(
      e.id,
      await insertar(tx, "EVIDENCE", "evidence_id", {
        blob_url: e.blob_url,
        procedure_id: e.procedimiento_id ? procedimiento.get(e.procedimiento_id) : null,
        finding_id: e.hallazgo_id ? hallazgo.get(e.hallazgo_id) : null,
        tracking_id: e.tracking_id,
        parent_id: e.evidencia_padre_id ? evidencia.get(e.evidencia_padre_id) : null,
        file_name: e.nombre_archivo,
        mime_type: e.tipo_mime,
        size_bytes: e.tamano_bytes,
        sha256: e.hash_sha256,
        uploaded_by: U(e.cargado_por_id),
        uploaded_at: e.fecha_carga,
        deleted: e.eliminado,
      }),
    );
  }

  const aprobacion = new Map<number, number>();
  for (const a of m.aprobaciones) {
    aprobacion.set(
      a.id,
      await insertar(tx, "APPROVAL", "approval_id", {
        approval_level: a.nivel,
        decision: a.decision,
        audit_id: auditoria.get(a.auditoria_id),
        sequence: a.secuencia,
        approver_id: U(a.aprobador_id),
        comments: a.comentarios,
        decided_at: a.fecha_decision,
        time_zone: a.zona_horaria,
      }),
    );
  }

  const plan = new Map<number, number>();
  for (const p of m.planes) {
    plan.set(
      p.id,
      await insertar(tx, "REMEDIATION_PLAN", "remediation_plan_id", {
        progress_pct: p.avance_pct,
        state: p.estado,
        finding_id: hallazgo.get(p.hallazgo_id),
        tracking_id: p.tracking_id,
        description: p.descripcion,
        responsible_id: U(p.responsable_id),
        due_date: p.fecha_compromiso,
        amount_mxn: p.monto_mxn,
        concluded_at: p.fecha_conclusion,
      }),
    );
  }
  for (const a of m.avances) {
    await insertar(tx, "PLAN_PROGRESS", "plan_progress_id", {
      progress_date: a.fecha,
      remediation_plan_id: plan.get(a.plan_id),
      progress_pct: a.avance_pct,
      comment: a.comentario,
      evidence_id: a.evidencia_id ? evidencia.get(a.evidencia_id) : null,
      updated_by: U(a.actualizado_por_id),
      time_zone: a.zona_horaria,
    });
  }

  const solicitud = new Map<number, number>();
  for (const s of m.solicitudesPbc) {
    solicitud.set(
      s.id,
      await insertar(tx, "REQUEST_PBC", "request_pbc_id", {
        state: s.estado,
        procedure_id: procedimiento.get(s.procedimiento_id),
        tracking_id: s.tracking_id,
        requested_by: s.solicitado_por_id ? U(s.solicitado_por_id) : null,
        requested_to: s.solicitado_a_id ? U(s.solicitado_a_id) : null,
        subject: s.asunto,
        due_date: s.fecha_limite,
        created_at: s.creado,
        sent_at: s.enviado,
        closed_at: s.cerrado,
        review_comment: s.comentario_revision,
      }),
    );
  }
  for (const p of m.puntosPbc) {
    await insertar(tx, "REQUEST_PBC_ITEM", "request_pbc_item_id", {
      request_pbc_id: solicitud.get(p.solicitud_id),
      description: p.descripcion,
      is_required: p.obligatorio,
      state: p.estado,
      sort_order: p.orden,
    });
  }

  const porEntidad: Record<string, Map<number, number>> = {
    hallazgos: hallazgo,
    aprobaciones: aprobacion,
    auditorias: auditoria,
    planes: plan,
    procedimientos_auditoria: procedimiento,
  };
  for (const b of m.bitacora) {
    await insertar(tx, "AUDIT_LOG", "audit_log_id", {
      entity: b.entidad,
      entity_id: b.entidad_id == null ? null : (porEntidad[b.entidad]?.get(b.entidad_id) ?? null),
      tracking_id: b.folio,
      action: b.accion,
      user_id: U(b.usuario_id),
      detail: b.detalle,
      ip: b.ip,
      time_zone: b.zona_horaria,
      created_at: b.fecha,
    });
  }
  for (const a of m.accesos) {
    await insertar(tx, "ACCESS_LOG", "access_log_id", {
      user_id: U(a.usuario_id),
      email: a.correo,
      result: a.resultado,
      ip: a.ip,
      user_agent: a.agente,
      time_zone: a.zona_horaria,
      created_at: a.fecha,
    });
  }
  return {
    roles: rol.size,
    usuarios: usuario.size,
    auditorias: auditoria.size,
    procedimientos: procedimiento.size,
    hallazgos: hallazgo.size,
    planes: plan.size,
  };
}

(async () => {
  const db = new ConexionSql();
  try {
    const [{ n }] = await db.consulta<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.AUDIT");
    const limpiar = process.argv.includes("--reiniciar");
    if (n > 0 && !limpiar) {
      const agregadas = await db.transaccion(asegurarEvidenciasIaDemo);
      if (agregadas) console.log(`Se agregaron ${agregadas} evidencias PDF de prueba a AUD-000008.`);
      console.log(
        `La tabla AUDIT ya tiene ${n} registros. Usa "npm run db:seed -- --reiniciar" para recargar los datos del Equipo 12.`,
      );
      return;
    }
    const resumen = await db.transaccion(async (tx) => {
      if (limpiar) await reiniciar(tx);
      return sembrar(tx, new BaseDeDatosMemoria());
    });
    console.log(`Datos cargados en ${process.env.DB_NAME}:`, resumen);
  } finally {
    await db.onModuleDestroy();
  }
})().catch((e) => {
  console.error("No se pudieron cargar los datos:", (e as Error).message);
  process.exit(1);
});
