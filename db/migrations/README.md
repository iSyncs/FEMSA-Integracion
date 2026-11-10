# Migraciones

Un archivo por cambio, con número consecutivo de tres dígitos y un nombre corto:

```
001-usuarios-y-sesiones.sql
002-pbc-detalle.sql
003-app-versions.sql
```

## Plantilla

```sql
-- 004-nombre-corto.sql
-- Equipo: 2 | 11
-- Qué hace: una línea.
-- Toca tablas compartidas: sí | no
-- Se puede correr dos veces: sí

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MI_TABLA')
BEGIN
  CREATE TABLE dbo.MI_TABLA (id INT IDENTITY PRIMARY KEY);
END
```

## Orden de llegada

Para que dos equipos no tomen el mismo número, se reserva al abrir el PR: se revisa el último en `develop` y se toma el siguiente. Si dos PR chocan, el segundo renumera antes de mergear.

## Migraciones actuales

| # | Equipo | Qué hace | Estado |
|---|---|---|---|
| 001 | 2 | Columnas y tablas que usa la API de auditoría (riesgos, participantes, bitácoras, catálogos) | Aplicada |
| 002 | 2 | `IA_ANALYSIS`: análisis de IA guardados | Aplicada |
| 003 | 2 | `IA_LOTE` e `IA_LOTE_EVIDENCE`: lotes de evidencia | Aplicada |
| 004 | 2 | `USER.password_hash` (bcrypt) | Aplicada |
| 005 | 2 | `USER_SESSION`: sesiones con cookie | Aplicada |
| 006 | 2 | Detalle de solicitudes PBC y `REQUEST_PBC_ITEM` | Aplicada |
| 007 | 2 | Índices de consultas frecuentes | Aplicada |

Las migraciones de Maple (`001-auth`, `002-app-versions` y `003-ai-recommendations` en su repo) entran con los siguientes números libres cuando se mueva su backend.
