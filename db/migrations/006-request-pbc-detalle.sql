-- 006-request-pbc-detalle.sql
-- Equipo: 2
-- Viene de: Femsa-equipo-2 backend/src/datos/sql/scripts/request_pbc_detalle.sql
-- Estado: ya aplicada en E12_FEMSA
-- Toca tablas compartidas: no (solo referencia a USER)
-- Se puede correr dos veces: sí

-- FE1S-12 · HU_05 Solicitudes de información (PBC): folio, quién pide, a quién, fecha límite y los puntos solicitados.
-- Solo agrega columnas y una tabla; las solicitudes existentes siguen funcionando.
IF COL_LENGTH('dbo.REQUEST_PBC', 'tracking_id') IS NULL
  ALTER TABLE dbo.REQUEST_PBC ADD
    tracking_id VARCHAR(20) NULL,
    requested_by INT NULL CONSTRAINT FK_REQUEST_PBC_REQUESTED_BY REFERENCES dbo.[USER](user_id),
    requested_to INT NULL CONSTRAINT FK_REQUEST_PBC_REQUESTED_TO REFERENCES dbo.[USER](user_id),
    subject NVARCHAR(300) NULL,
    due_date DATE NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_REQUEST_PBC_CREATED DEFAULT SYSUTCDATETIME(),
    sent_at DATETIME2 NULL,
    closed_at DATETIME2 NULL,
    review_comment NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_REQUEST_PBC_TRACKING')
  CREATE UNIQUE INDEX UQ_REQUEST_PBC_TRACKING ON dbo.REQUEST_PBC (tracking_id) WHERE tracking_id IS NOT NULL;
GO
-- Folio para las solicitudes que ya existían.
UPDATE dbo.REQUEST_PBC SET tracking_id = CONCAT('PBC-', RIGHT(CONCAT('000000', request_pbc_id), 6)) WHERE tracking_id IS NULL;
GO
IF OBJECT_ID('dbo.REQUEST_PBC_ITEM') IS NULL
BEGIN
  CREATE TABLE dbo.REQUEST_PBC_ITEM (
    request_pbc_item_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_REQUEST_PBC_ITEM PRIMARY KEY,
    request_pbc_id INT NOT NULL CONSTRAINT FK_REQUEST_PBC_ITEM_REQUEST REFERENCES dbo.REQUEST_PBC(request_pbc_id),
    description NVARCHAR(300) NOT NULL,
    is_required BIT NOT NULL CONSTRAINT DF_REQUEST_PBC_ITEM_REQUIRED DEFAULT 1,
    state VARCHAR(20) NOT NULL CONSTRAINT DF_REQUEST_PBC_ITEM_STATE DEFAULT 'pendiente'
      CONSTRAINT CK_REQUEST_PBC_ITEM_STATE CHECK (state IN ('pendiente', 'cubierto', 'faltante')),
    sort_order INT NOT NULL CONSTRAINT DF_REQUEST_PBC_ITEM_ORDER DEFAULT 1
  );
  CREATE INDEX IX_REQUEST_PBC_ITEM_REQUEST ON dbo.REQUEST_PBC_ITEM (request_pbc_id);
END
GO
