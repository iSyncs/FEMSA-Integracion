-- 03-tablas-eq12.sql · tablas base del Equipo 2 (AUDIT, CONTROL, PROCEDURE, FINDING, EVIDENCE, planes...)
-- Viene de: hectorpablogzz/auditoria_bd@3124744 scripts/tablas_eq12.sql
-- Base inicial: ya existe en E12_FEMSA. Solo para crear una base nueva desde cero. NO se puede correr dos veces.

-- TABLAS DEL EQUIPO 12 (MesaPara7) --

--Tabla AUDIT--
CREATE TABLE dbo.AUDIT
(
    audit_id INT IDENTITY(1,1) NOT NULL,
    tracking_id VARCHAR(200) NOT NULL,
    state VARCHAR(200) NOT NULL,
    user_id INT NOT NULL,

    CONSTRAINT PK_AUDIT
        PRIMARY KEY (audit_id),

    CONSTRAINT FK_AUDIT_USER
        FOREIGN KEY (user_id)
        REFERENCES dbo.[USER](user_id)
);

--Tabla CONTROL--
CREATE TABLE dbo.CONTROL
(
    control_id INT IDENTITY(1,1) NOT NULL,
    tracking_id VARCHAR(200) NOT NULL,
    associated_risk VARCHAR(200) NOT NULL,

    CONSTRAINT PK_CONTROL
        PRIMARY KEY (control_id)
);

--Tabla BUSINESS_UNIT--
CREATE TABLE dbo.BUSINESS_UNIT
(
    business_unit_id INT IDENTITY(1,1) NOT NULL,
    unity VARCHAR(200) NOT NULL,
    country VARCHAR(200) NOT NULL,
    audit_id INT NOT NULL,

    CONSTRAINT PK_BUSINESS_UNIT
        PRIMARY KEY (business_unit_id),

    CONSTRAINT FK_BUSINESS_UNIT_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id)
);

--Tabla FINDING--
CREATE TABLE dbo.FINDING
(
    finding_id INT IDENTITY(1,1) NOT NULL,
    severity VARCHAR(200) NOT NULL,
    state VARCHAR(200) NOT NULL,
    audit_id INT NOT NULL,

    CONSTRAINT PK_FINDING
        PRIMARY KEY (finding_id),

    CONSTRAINT FK_FINDING_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id)
);

--Tabla PROCEDURE--
CREATE TABLE dbo.[PROCEDURE]
(
    procedure_id INT IDENTITY(1,1) NOT NULL,
    effectiveness_rating VARCHAR(200) NOT NULL,
    audit_id INT NOT NULL,
    control_id INT NOT NULL,
    finding_id INT NOT NULL,

    CONSTRAINT PK_PROCEDURE
        PRIMARY KEY (procedure_id),

    CONSTRAINT FK_PROCEDURE_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id),

    CONSTRAINT FK_PROCEDURE_CONTROL
        FOREIGN KEY (control_id)
        REFERENCES dbo.CONTROL(control_id),

    CONSTRAINT FK_PROCEDURE_FINDING
        FOREIGN KEY (finding_id)
        REFERENCES dbo.FINDING(finding_id)
);

--Tabla APPROVAL--
CREATE TABLE dbo.APPROVAL
(
    approval_id INT IDENTITY(1,1) NOT NULL,
    approval_level VARCHAR(200) NOT NULL,
    decision VARCHAR(200) NOT NULL,
    audit_id INT NOT NULL,

    CONSTRAINT PK_APPROVAL
        PRIMARY KEY (approval_id),

    CONSTRAINT FK_APPROVAL_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id)
);

--Tabla AUDIT_CLOSURE--
CREATE TABLE dbo.AUDIT_CLOSURE
(
    audit_closure_id INT IDENTITY(1,1) NOT NULL,
    integrity_hash VARCHAR(200) NOT NULL,
    blocked BIT NOT NULL DEFAULT 0,
    audit_id INT NOT NULL,

    CONSTRAINT PK_AUDIT_CLOSURE
        PRIMARY KEY (audit_closure_id),

    CONSTRAINT FK_AUDIT_CLOSURE_AUDIT
        FOREIGN KEY (audit_id)
        REFERENCES dbo.AUDIT(audit_id)
);

--Tabla REQUEST_PBC--
CREATE TABLE dbo.REQUEST_PBC
(
    request_pbc_id INT IDENTITY(1,1) NOT NULL,
    state VARCHAR(200) NOT NULL,
    procedure_id INT NOT NULL,

    CONSTRAINT PK_REQUEST_PBC
        PRIMARY KEY (request_pbc_id),

    CONSTRAINT FK_REQUEST_PBC_PROCEDURE
        FOREIGN KEY (procedure_id)
        REFERENCES dbo.[PROCEDURE](procedure_id)
);

--Tabla EVIDENCE--
CREATE TABLE dbo.EVIDENCE
(
    evidence_id INT IDENTITY(1,1) NOT NULL,
    blob_url VARCHAR(200) NOT NULL,
    procedure_id INT NOT NULL,
    finding_id INT NOT NULL,

    CONSTRAINT PK_EVIDENCE
        PRIMARY KEY (evidence_id),

    CONSTRAINT FK_EVIDENCE_PROCEDURE
        FOREIGN KEY (procedure_id)
        REFERENCES dbo.[PROCEDURE](procedure_id),

    CONSTRAINT FK_EVIDENCE_FINDING
        FOREIGN KEY (finding_id)
        REFERENCES dbo.FINDING(finding_id)
);

--Tabla EXEMPTION_REQUEST--
CREATE TABLE dbo.EXEMPTION_REQUEST
(
    exemption_request_id INT IDENTITY(1,1) NOT NULL,
    state VARCHAR(200) NOT NULL,
    finding_id INT NOT NULL,

    CONSTRAINT PK_EXEMPTION_REQUEST
        PRIMARY KEY (exemption_request_id),

    CONSTRAINT FK_EXEMPTION_REQUEST_FINDING
        FOREIGN KEY (finding_id)
        REFERENCES dbo.FINDING(finding_id)
);

--Tabla REMEDIATION_PLAN--
CREATE TABLE dbo.REMEDIATION_PLAN
(
    remediation_plan_id INT IDENTITY(1,1) NOT NULL,
    progress_pct INT NOT NULL DEFAULT 0,
    state VARCHAR(200) NOT NULL,
    finding_id INT NOT NULL,

    CONSTRAINT PK_REMEDIATION_PLAN
        PRIMARY KEY (remediation_plan_id),

    CONSTRAINT FK_REMEDIATION_PLAN_FINDING
        FOREIGN KEY (finding_id)
        REFERENCES dbo.FINDING(finding_id)
);

--Tabla PLAN_PROGRESS--
CREATE TABLE dbo.PLAN_PROGRESS
(
    plan_progress_id INT IDENTITY(1,1) NOT NULL,
    progress_date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    remediation_plan_id INT NOT NULL,

    CONSTRAINT PK_PLAN_PROGRESS
        PRIMARY KEY (plan_progress_id),

    CONSTRAINT FK_PLAN_PROGRESS_REMEDIATION_PLAN
        FOREIGN KEY (remediation_plan_id)
        REFERENCES dbo.REMEDIATION_PLAN(remediation_plan_id)
);

--Tabla NOTIFICATION--
CREATE TABLE dbo.NOTIFICATION
(
    notification_id INT IDENTITY(1,1) NOT NULL,
    type VARCHAR(200) NOT NULL,
    remediation_plan_id INT NOT NULL,

    CONSTRAINT PK_NOTIFICATION
        PRIMARY KEY (notification_id),

    CONSTRAINT FK_NOTIFICATION_REMEDIATION_PLAN
        FOREIGN KEY (remediation_plan_id)
        REFERENCES dbo.REMEDIATION_PLAN(remediation_plan_id)
);
