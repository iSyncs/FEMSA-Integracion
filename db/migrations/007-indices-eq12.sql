-- 007-indices-eq12.sql
-- Equipo: 2
-- Viene de: Femsa-equipo-2 backend/src/datos/sql/scripts/indices_eq12.sql
-- Estado: ya aplicada en E12_FEMSA
-- Toca tablas compartidas: no
-- Se puede correr dos veces: sí

-- FE1S-26 · Índices para las consultas más frecuentes del Equipo 12 y folios únicos.
-- Solo crea índices (no cambia datos). Cada uno se crea si todavía no existe, así que se puede correr de nuevo.

-- Folios únicos: el sistema calcula el siguiente folio con MAX(tracking_id); con el índice esa lectura es directa
-- y la base rechaza un folio repetido aunque dos peticiones lleguen al mismo tiempo.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FINDING_TRACKING_ID')
  CREATE UNIQUE INDEX UQ_FINDING_TRACKING_ID ON dbo.FINDING (tracking_id) WHERE tracking_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_PROCEDURE_TRACKING_ID')
  CREATE UNIQUE INDEX UQ_PROCEDURE_TRACKING_ID ON dbo.[PROCEDURE] (tracking_id) WHERE tracking_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_REMEDIATION_PLAN_TRACKING_ID')
  CREATE UNIQUE INDEX UQ_REMEDIATION_PLAN_TRACKING_ID ON dbo.REMEDIATION_PLAN (tracking_id) WHERE tracking_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_EVIDENCE_TRACKING_ID')
  CREATE UNIQUE INDEX UQ_EVIDENCE_TRACKING_ID ON dbo.EVIDENCE (tracking_id) WHERE tracking_id IS NOT NULL;

-- Relaciones que se consultan en cada pantalla de auditoría.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FINDING_AUDIT')
  CREATE INDEX IX_FINDING_AUDIT ON dbo.FINDING (audit_id) INCLUDE (state, severity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PROCEDURE_AUDIT')
  CREATE INDEX IX_PROCEDURE_AUDIT ON dbo.[PROCEDURE] (audit_id) INCLUDE (state);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_REMEDIATION_PLAN_FINDING')
  CREATE INDEX IX_REMEDIATION_PLAN_FINDING ON dbo.REMEDIATION_PLAN (finding_id) INCLUDE (state, due_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EVIDENCE_PROCEDURE')
  CREATE INDEX IX_EVIDENCE_PROCEDURE ON dbo.EVIDENCE (procedure_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PLAN_PROGRESS_PLAN')
  CREATE INDEX IX_PLAN_PROGRESS_PLAN ON dbo.PLAN_PROGRESS (remediation_plan_id, progress_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_REQUEST_PBC_PROCEDURE')
  CREATE INDEX IX_REQUEST_PBC_PROCEDURE ON dbo.REQUEST_PBC (procedure_id) INCLUDE (state, due_date);

-- Campana de notificaciones: avisos de cada usuario y el contador de no leídos (se consulta cada 15 s).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NOTIFICATION_USER')
  CREATE INDEX IX_NOTIFICATION_USER ON dbo.NOTIFICATION (user_id, is_read) INCLUDE (type, remediation_plan_id);

-- Bitácora: el feed ordena por fecha y filtra por entidad o usuario.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AUDIT_LOG_CREATED')
  CREATE INDEX IX_AUDIT_LOG_CREATED ON dbo.AUDIT_LOG (created_at DESC) INCLUDE (entity, entity_id, action, user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AUDIT_LOG_ENTITY')
  CREATE INDEX IX_AUDIT_LOG_ENTITY ON dbo.AUDIT_LOG (entity, entity_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ACCESS_LOG_CREATED')
  CREATE INDEX IX_ACCESS_LOG_CREATED ON dbo.ACCESS_LOG (created_at DESC) INCLUDE (user_id, result);
