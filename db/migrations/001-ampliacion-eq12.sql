-- 001-ampliacion-eq12.sql
-- Equipo: 2
-- Viene de: hectorpablogzz/auditoria_bd@3124744 scripts/ampliacion_eq12.sql
-- Estado: ya aplicada en E12_FEMSA
-- Toca tablas compartidas: sí: agrega columnas a ROLE, USER y BUSINESS_UNIT
-- Se puede correr dos veces: sí

-- AMPLIACION DE TABLAS DEL EQUIPO 12 (MesaPara7) --
-- Agrega las columnas y tablas que usa la API del Equipo 12 (ejecucion, cierre y seguimiento).
-- Se ejecuta despues de tablas_compartidas.sql y tablas_eq12.sql. Se puede correr mas de una vez.
-- En las tablas compartidas (ROLE, USER) solo agrega columnas opcionales; no modifica filas existentes.

--Tabla ROLE: clave del rol para la API del Equipo 12--
IF COL_LENGTH('dbo.ROLE', 'code') IS NULL
    ALTER TABLE dbo.[ROLE] ADD code VARCHAR(30) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_ROLE_CODE')
    CREATE UNIQUE INDEX UQ_ROLE_CODE ON dbo.[ROLE](code) WHERE code IS NOT NULL;
GO

--Tabla BUSINESS_UNIT: catalogo de unidades de negocio--
IF COL_LENGTH('dbo.BUSINESS_UNIT', 'code') IS NULL
    ALTER TABLE dbo.BUSINESS_UNIT ADD
        code VARCHAR(20) NULL,
        direction VARCHAR(30) NULL,
        division VARCHAR(100) NULL,
        area VARCHAR(100) NULL,
        time_zone VARCHAR(64) NULL;
GO
-- Una unidad de negocio tiene muchas auditorias: la relacion vive en AUDIT.business_unit_id
ALTER TABLE dbo.BUSINESS_UNIT ALTER COLUMN audit_id INT NULL;
GO

--Tabla USER: direccion, unidad de negocio y zona horaria para la seguridad por fila--
IF COL_LENGTH('dbo.USER', 'direction') IS NULL
    ALTER TABLE dbo.[USER] ADD
        direction VARCHAR(30) NULL,
        business_unit_id INT NULL,
        time_zone VARCHAR(64) NULL;
GO
IF OBJECT_ID('dbo.FK_USER_BUSINESS_UNIT') IS NULL
    ALTER TABLE dbo.[USER] ADD CONSTRAINT FK_USER_BUSINESS_UNIT
        FOREIGN KEY (business_unit_id) REFERENCES dbo.BUSINESS_UNIT(business_unit_id);
GO

--Tabla AUDIT--
IF COL_LENGTH('dbo.AUDIT', 'name') IS NULL
    ALTER TABLE dbo.AUDIT ADD
        name NVARCHAR(200) NULL,
        objective NVARCHAR(1000) NULL,
        business_unit_id INT NULL,
        audit_type VARCHAR(40) NULL,
        area NVARCHAR(100) NULL,
        priority VARCHAR(10) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_AUDIT_CREATED_AT DEFAULT SYSUTCDATETIME();
GO
IF OBJECT_ID('dbo.FK_AUDIT_BUSINESS_UNIT') IS NULL
    ALTER TABLE dbo.AUDIT ADD CONSTRAINT FK_AUDIT_BUSINESS_UNIT
        FOREIGN KEY (business_unit_id) REFERENCES dbo.BUSINESS_UNIT(business_unit_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_AUDIT_TRACKING_ID')
    CREATE UNIQUE INDEX UQ_AUDIT_TRACKING_ID ON dbo.AUDIT(tracking_id);
GO

--Tabla AUDIT_PARTICIPANT: quien participa en cada auditoria (seguridad por fila del auditado)--
IF OBJECT_ID('dbo.AUDIT_PARTICIPANT') IS NULL
CREATE TABLE dbo.AUDIT_PARTICIPANT
(
    audit_id INT NOT NULL,
    user_id INT NOT NULL,
    role_in_audit VARCHAR(30) NOT NULL,

    CONSTRAINT PK_AUDIT_PARTICIPANT
        PRIMARY KEY (audit_id, user_id),

    CONSTRAINT FK_AUDIT_PARTICIPANT_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id),

    CONSTRAINT FK_AUDIT_PARTICIPANT_USER
        FOREIGN KEY (user_id)
        REFERENCES dbo.[USER](user_id)
);
GO

--Tabla RISK: riesgo que mitiga cada control--
IF OBJECT_ID('dbo.RISK') IS NULL
CREATE TABLE dbo.RISK
(
    risk_id INT IDENTITY(1,1) NOT NULL,
    tracking_id VARCHAR(30) NOT NULL,
    name NVARCHAR(300) NOT NULL,
    category VARCHAR(60) NOT NULL,
    inherent_level VARCHAR(20) NOT NULL,

    CONSTRAINT PK_RISK
        PRIMARY KEY (risk_id),

    CONSTRAINT UQ_RISK_TRACKING_ID
        UNIQUE (tracking_id)
);
GO

--Tabla CONTROL--
IF COL_LENGTH('dbo.CONTROL', 'name') IS NULL
    ALTER TABLE dbo.CONTROL ADD
        name NVARCHAR(300) NULL,
        domain VARCHAR(60) NULL,
        risk_id INT NULL;
GO
IF OBJECT_ID('dbo.FK_CONTROL_RISK') IS NULL
    ALTER TABLE dbo.CONTROL ADD CONSTRAINT FK_CONTROL_RISK
        FOREIGN KEY (risk_id) REFERENCES dbo.RISK(risk_id);
GO

--Tabla PROCEDURE: evaluacion de diseno, efectividad y vulnerabilidad (HU_02)--
IF COL_LENGTH('dbo.PROCEDURE', 'tracking_id') IS NULL
    ALTER TABLE dbo.[PROCEDURE] ADD
        tracking_id VARCHAR(30) NULL,
        auditor_id INT NULL,
        state VARCHAR(20) NOT NULL CONSTRAINT DF_PROCEDURE_STATE DEFAULT 'abierto',
        design_rating VARCHAR(20) NULL,
        vulnerability VARCHAR(20) NULL,
        applies_finding BIT NOT NULL CONSTRAINT DF_PROCEDURE_APPLIES_FINDING DEFAULT 0,
        comments NVARCHAR(2000) NULL,
        evaluated_at DATETIME2 NULL;
GO
-- Un procedimiento se crea antes de saber si tendra hallazgo
ALTER TABLE dbo.[PROCEDURE] ALTER COLUMN effectiveness_rating VARCHAR(200) NULL;
ALTER TABLE dbo.[PROCEDURE] ALTER COLUMN finding_id INT NULL;
GO
IF OBJECT_ID('dbo.FK_PROCEDURE_AUDITOR') IS NULL
    ALTER TABLE dbo.[PROCEDURE] ADD CONSTRAINT FK_PROCEDURE_AUDITOR
        FOREIGN KEY (auditor_id) REFERENCES dbo.[USER](user_id);
GO

--Tabla FINDING: registro metodologico GIAS (HU_04)--
IF COL_LENGTH('dbo.FINDING', 'tracking_id') IS NULL
    ALTER TABLE dbo.FINDING ADD
        tracking_id VARCHAR(30) NULL,
        procedure_id INT NULL,
        title NVARCHAR(300) NULL,
        condition NVARCHAR(MAX) NULL,
        criteria NVARCHAR(MAX) NULL,
        cause NVARCHAR(MAX) NULL,
        effect NVARCHAR(MAX) NULL,
        recommendation NVARCHAR(MAX) NULL,
        finding_type VARCHAR(40) NULL,
        residual_risk VARCHAR(20) NULL,
        impact_mxn DECIMAL(18,2) NULL,
        responsible_id INT NULL,
        identified_at DATETIME2 NOT NULL CONSTRAINT DF_FINDING_IDENTIFIED_AT DEFAULT SYSUTCDATETIME();
GO
IF OBJECT_ID('dbo.FK_FINDING_PROCEDURE') IS NULL
    ALTER TABLE dbo.FINDING ADD CONSTRAINT FK_FINDING_PROCEDURE
        FOREIGN KEY (procedure_id) REFERENCES dbo.[PROCEDURE](procedure_id);
GO
IF OBJECT_ID('dbo.FK_FINDING_RESPONSIBLE') IS NULL
    ALTER TABLE dbo.FINDING ADD CONSTRAINT FK_FINDING_RESPONSIBLE
        FOREIGN KEY (responsible_id) REFERENCES dbo.[USER](user_id);
GO

--Tabla EVIDENCE: archivos de soporte (HU_03)--
IF COL_LENGTH('dbo.EVIDENCE', 'tracking_id') IS NULL
    ALTER TABLE dbo.EVIDENCE ADD
        tracking_id VARCHAR(40) NULL,
        parent_id INT NULL,
        request_pbc_id INT NULL,
        file_name NVARCHAR(260) NULL,
        mime_type VARCHAR(150) NULL,
        size_bytes BIGINT NULL,
        sha256 CHAR(64) NULL,
        uploaded_by INT NULL,
        uploaded_at DATETIME2 NOT NULL CONSTRAINT DF_EVIDENCE_UPLOADED_AT DEFAULT SYSUTCDATETIME(),
        deleted BIT NOT NULL CONSTRAINT DF_EVIDENCE_DELETED DEFAULT 0;
GO
-- Una evidencia pertenece a un procedimiento, a un hallazgo, a una PBC o a un ZIP padre
ALTER TABLE dbo.EVIDENCE ALTER COLUMN blob_url VARCHAR(1000) NULL;
ALTER TABLE dbo.EVIDENCE ALTER COLUMN procedure_id INT NULL;
ALTER TABLE dbo.EVIDENCE ALTER COLUMN finding_id INT NULL;
GO
IF OBJECT_ID('dbo.FK_EVIDENCE_PARENT') IS NULL
    ALTER TABLE dbo.EVIDENCE ADD CONSTRAINT FK_EVIDENCE_PARENT
        FOREIGN KEY (parent_id) REFERENCES dbo.EVIDENCE(evidence_id);
GO
IF OBJECT_ID('dbo.FK_EVIDENCE_REQUEST_PBC') IS NULL
    ALTER TABLE dbo.EVIDENCE ADD CONSTRAINT FK_EVIDENCE_REQUEST_PBC
        FOREIGN KEY (request_pbc_id) REFERENCES dbo.REQUEST_PBC(request_pbc_id);
GO
IF OBJECT_ID('dbo.FK_EVIDENCE_UPLOADED_BY') IS NULL
    ALTER TABLE dbo.EVIDENCE ADD CONSTRAINT FK_EVIDENCE_UPLOADED_BY
        FOREIGN KEY (uploaded_by) REFERENCES dbo.[USER](user_id);
GO

--Tabla APPROVAL: cadena de firmas Jefe, Gerente y Director (HU_07)--
IF COL_LENGTH('dbo.APPROVAL', 'sequence') IS NULL
    ALTER TABLE dbo.APPROVAL ADD
        sequence INT NULL,
        approver_id INT NULL,
        comments NVARCHAR(1000) NULL,
        decided_at DATETIME2 NULL,
        time_zone VARCHAR(64) NULL;
GO
IF OBJECT_ID('dbo.FK_APPROVAL_APPROVER') IS NULL
    ALTER TABLE dbo.APPROVAL ADD CONSTRAINT FK_APPROVAL_APPROVER
        FOREIGN KEY (approver_id) REFERENCES dbo.[USER](user_id);
GO

--Tabla AUDIT_CLOSURE: sello SHA-256 del expediente (HU_08)--
IF COL_LENGTH('dbo.AUDIT_CLOSURE', 'closed_by') IS NULL
    ALTER TABLE dbo.AUDIT_CLOSURE ADD
        closed_by INT NULL,
        sealed_at DATETIME2 NULL,
        algorithm VARCHAR(20) NULL,
        manifest NVARCHAR(MAX) NULL,
        signature VARCHAR(500) NULL;
GO
IF OBJECT_ID('dbo.FK_AUDIT_CLOSURE_CLOSED_BY') IS NULL
    ALTER TABLE dbo.AUDIT_CLOSURE ADD CONSTRAINT FK_AUDIT_CLOSURE_CLOSED_BY
        FOREIGN KEY (closed_by) REFERENCES dbo.[USER](user_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_AUDIT_CLOSURE_AUDIT')
    CREATE UNIQUE INDEX UQ_AUDIT_CLOSURE_AUDIT ON dbo.AUDIT_CLOSURE(audit_id);
GO

--Tabla REMEDIATION_PLAN (HU_09)--
IF COL_LENGTH('dbo.REMEDIATION_PLAN', 'tracking_id') IS NULL
    ALTER TABLE dbo.REMEDIATION_PLAN ADD
        tracking_id VARCHAR(30) NULL,
        description NVARCHAR(1000) NULL,
        responsible_id INT NULL,
        due_date DATETIME2 NULL,
        amount_mxn DECIMAL(18,2) NULL,
        concluded_at DATETIME2 NULL;
GO
IF OBJECT_ID('dbo.FK_REMEDIATION_PLAN_RESPONSIBLE') IS NULL
    ALTER TABLE dbo.REMEDIATION_PLAN ADD CONSTRAINT FK_REMEDIATION_PLAN_RESPONSIBLE
        FOREIGN KEY (responsible_id) REFERENCES dbo.[USER](user_id);
GO

--Tabla PLAN_PROGRESS: avances del plan (HU_10)--
IF COL_LENGTH('dbo.PLAN_PROGRESS', 'progress_pct') IS NULL
    ALTER TABLE dbo.PLAN_PROGRESS ADD
        progress_pct INT NULL,
        comment NVARCHAR(1000) NULL,
        evidence_id INT NULL,
        updated_by INT NULL,
        time_zone VARCHAR(64) NULL;
GO
IF OBJECT_ID('dbo.FK_PLAN_PROGRESS_EVIDENCE') IS NULL
    ALTER TABLE dbo.PLAN_PROGRESS ADD CONSTRAINT FK_PLAN_PROGRESS_EVIDENCE
        FOREIGN KEY (evidence_id) REFERENCES dbo.EVIDENCE(evidence_id);
GO
IF OBJECT_ID('dbo.FK_PLAN_PROGRESS_UPDATED_BY') IS NULL
    ALTER TABLE dbo.PLAN_PROGRESS ADD CONSTRAINT FK_PLAN_PROGRESS_UPDATED_BY
        FOREIGN KEY (updated_by) REFERENCES dbo.[USER](user_id);
GO

--Tabla NOTIFICATION (HU_12)--
IF COL_LENGTH('dbo.NOTIFICATION', 'user_id') IS NULL
    ALTER TABLE dbo.NOTIFICATION ADD
        user_id INT NULL,
        audit_id INT NULL,
        message NVARCHAR(500) NULL,
        channel VARCHAR(20) NULL,
        scheduled_at DATETIME2 NULL,
        sent_at DATETIME2 NULL,
        is_read BIT NOT NULL CONSTRAINT DF_NOTIFICATION_IS_READ DEFAULT 0;
GO
-- Hay avisos de auditoria (cierre rechazado) que no se ligan a un plan
ALTER TABLE dbo.NOTIFICATION ALTER COLUMN remediation_plan_id INT NULL;
GO
IF OBJECT_ID('dbo.FK_NOTIFICATION_USER') IS NULL
    ALTER TABLE dbo.NOTIFICATION ADD CONSTRAINT FK_NOTIFICATION_USER
        FOREIGN KEY (user_id) REFERENCES dbo.[USER](user_id);
GO
IF OBJECT_ID('dbo.FK_NOTIFICATION_AUDIT') IS NULL
    ALTER TABLE dbo.NOTIFICATION ADD CONSTRAINT FK_NOTIFICATION_AUDIT
        FOREIGN KEY (audit_id) REFERENCES dbo.AUDIT(audit_id);
GO

--Tabla AUDIT_LOG: bitacora de operaciones, solo se agregan registros (HU_15)--
IF OBJECT_ID('dbo.AUDIT_LOG') IS NULL
CREATE TABLE dbo.AUDIT_LOG
(
    audit_log_id INT IDENTITY(1,1) NOT NULL,
    entity VARCHAR(60) NOT NULL,
    entity_id INT NULL,
    tracking_id VARCHAR(40) NULL,
    action VARCHAR(30) NOT NULL,
    user_id INT NULL,
    detail NVARCHAR(MAX) NULL,
    ip VARCHAR(64) NULL,
    time_zone VARCHAR(64) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_AUDIT_LOG
        PRIMARY KEY (audit_log_id),

    CONSTRAINT FK_AUDIT_LOG_USER
        FOREIGN KEY (user_id)
        REFERENCES dbo.[USER](user_id)
);
GO

--Tabla ACCESS_LOG: bitacora de accesos (HU_15)--
IF OBJECT_ID('dbo.ACCESS_LOG') IS NULL
CREATE TABLE dbo.ACCESS_LOG
(
    access_log_id INT IDENTITY(1,1) NOT NULL,
    user_id INT NULL,
    email VARCHAR(200) NULL,
    result VARCHAR(20) NOT NULL,
    ip VARCHAR(64) NULL,
    user_agent VARCHAR(300) NULL,
    time_zone VARCHAR(64) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_ACCESS_LOG
        PRIMARY KEY (access_log_id),

    CONSTRAINT FK_ACCESS_LOG_USER
        FOREIGN KEY (user_id)
        REFERENCES dbo.[USER](user_id)
);
GO
