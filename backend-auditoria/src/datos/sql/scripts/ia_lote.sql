-- Lotes de evidencia que el área auditada envía en respuesta a una solicitud PBC.
-- Al llegar, la IA analiza cada PDF del lote sin que el auditor lo pida. Se puede correr más de una vez.
IF OBJECT_ID('dbo.IA_LOTE') IS NULL
CREATE TABLE dbo.IA_LOTE (
  lote_id        INT IDENTITY(1,1) NOT NULL,
  tracking_id    VARCHAR(20)   NOT NULL,
  audit_id       INT           NOT NULL,
  request_pbc_id INT           NULL,
  sent_by        INT           NOT NULL,
  subject        NVARCHAR(300) NOT NULL,
  state          VARCHAR(20)   NOT NULL CONSTRAINT DF_IA_LOTE_STATE DEFAULT 'pendiente',
  total_docs     INT           NOT NULL,
  analyzed_docs  INT           NOT NULL CONSTRAINT DF_IA_LOTE_ANALYZED DEFAULT 0,
  error          NVARCHAR(500) NULL,
  created_at     DATETIME2     NOT NULL CONSTRAINT DF_IA_LOTE_CREATED_AT DEFAULT SYSUTCDATETIME(),
  started_at     DATETIME2     NULL,
  finished_at    DATETIME2     NULL,
  CONSTRAINT PK_IA_LOTE PRIMARY KEY (lote_id),
  CONSTRAINT UQ_IA_LOTE_TRACKING UNIQUE (tracking_id),
  CONSTRAINT FK_IA_LOTE_AUDIT FOREIGN KEY (audit_id) REFERENCES dbo.AUDIT (audit_id),
  CONSTRAINT FK_IA_LOTE_PBC FOREIGN KEY (request_pbc_id) REFERENCES dbo.REQUEST_PBC (request_pbc_id),
  CONSTRAINT FK_IA_LOTE_USER FOREIGN KEY (sent_by) REFERENCES dbo.[USER] (user_id),
  CONSTRAINT CK_IA_LOTE_STATE CHECK (state IN ('pendiente', 'analizando', 'listo', 'error'))
);

IF OBJECT_ID('dbo.IA_LOTE_EVIDENCE') IS NULL
CREATE TABLE dbo.IA_LOTE_EVIDENCE (
  lote_id     INT NOT NULL,
  evidence_id INT NOT NULL,
  CONSTRAINT PK_IA_LOTE_EVIDENCE PRIMARY KEY (lote_id, evidence_id),
  CONSTRAINT UQ_IA_LOTE_EVIDENCE UNIQUE (evidence_id),
  CONSTRAINT FK_IA_LOTE_EVIDENCE_LOTE FOREIGN KEY (lote_id) REFERENCES dbo.IA_LOTE (lote_id),
  CONSTRAINT FK_IA_LOTE_EVIDENCE_EVIDENCE FOREIGN KEY (evidence_id) REFERENCES dbo.EVIDENCE (evidence_id)
);
