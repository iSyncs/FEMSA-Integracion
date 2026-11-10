-- 002-ia-analysis.sql
-- Equipo: 2
-- Viene de: Femsa-equipo-2 backend/src/datos/sql/scripts/ia_analysis.sql
-- Estado: ya aplicada en E12_FEMSA
-- Toca tablas compartidas: no (solo referencia a USER)
-- Se puede correr dos veces: sí

-- Análisis de IA guardados (Sugerencias de la IA). Uno por evidencia; el resultado va como JSON.
-- Se puede correr más de una vez.
IF OBJECT_ID('dbo.IA_ANALYSIS') IS NULL
CREATE TABLE dbo.IA_ANALYSIS
(
    analysis_id INT IDENTITY(1,1) NOT NULL,
    audit_id INT NOT NULL,
    evidence_id INT NOT NULL,
    batch VARCHAR(40) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    created_by INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_IA_ANALYSIS_CREATED_AT DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT PK_IA_ANALYSIS PRIMARY KEY (analysis_id),
    CONSTRAINT UQ_IA_ANALYSIS_EVIDENCE UNIQUE (audit_id, evidence_id),
    CONSTRAINT FK_IA_ANALYSIS_AUDIT FOREIGN KEY (audit_id) REFERENCES dbo.AUDIT(audit_id),
    CONSTRAINT FK_IA_ANALYSIS_EVIDENCE FOREIGN KEY (evidence_id) REFERENCES dbo.EVIDENCE(evidence_id),
    CONSTRAINT FK_IA_ANALYSIS_USER FOREIGN KEY (created_by) REFERENCES dbo.[USER](user_id),
    CONSTRAINT CK_IA_ANALYSIS_PAYLOAD CHECK (ISJSON(payload) = 1)
);
