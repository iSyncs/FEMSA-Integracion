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

Las migraciones actuales de cada equipo se importan en la Fase 2 (ver [docs/arquitectura/integracion.md](../../docs/arquitectura/integracion.md)).
