# db

La base es **una sola**: Azure SQL `E12_FEMSA`, compartida por los dos equipos. Cualquier cambio de esquema puede romper al otro equipo, por eso todo pasa por aquí.

| Carpeta | Qué tiene | ¿Se corre en `E12_FEMSA`? |
|---|---|---|
| [`base/`](base/) | Tablas iniciales (compartidas, Equipo 11 y Equipo 2), copiadas de [auditoria_bd](https://github.com/hectorpablogzz/auditoria_bd) | **No.** Ya existen; solo sirven para crear una base nueva desde cero |
| [`migrations/`](migrations/README.md) | Cada cambio de esquema posterior, numerado | Sí, en orden. Las que ya están aplicadas lo dicen en su cabecera |
| [`semillas/`](semillas/) | Datos de prueba ficticios (`@demo.femsa.test`) | Solo en bases de desarrollo |

## Crear una base nueva desde cero

En orden: `base/01`, `base/02`, `base/03`, todas las de `migrations/` por número, y si se quiere, `semillas/`. Con el backend de auditoría configurado (`backend-auditoria/.env`):

```bash
cd backend-auditoria
npm run db:sql -- ../db/base/01-tablas-compartidas.sql
npm run db:sql -- ../db/migrations/001-ampliacion-eq12.sql
npm run db:seed        # datos de demostración del Equipo 2
```

## Reglas

- Todo cambio de esquema es un archivo numerado en [`migrations/`](migrations/README.md). Nunca se edita una migración ya aplicada: se agrega otra.
- Toda migración que toque `USER`, `ROLE`, permisos o unidades de negocio la revisa **alguien del otro equipo**.
- Las migraciones deben poder correrse dos veces sin error (`IF NOT EXISTS`, `OBJECT_ID`, `COL_LENGTH`).
- Aplicar en Azure es manual y lo hace quien administra la base (Carlos). Se avisa en el PR antes de aplicar.
- Nada de datos reales ni contraseñas en este repo.

## Tablas que tocan los dos equipos

`USER`, `ROLE`, `PERMISSION`, `ROLE_PERMISSION`, `APPLICATION_USER_ROLE`, `USER_SESSION` y las unidades de negocio. Los dos equipos usan **los mismos roles**; nadie agrega roles propios sin acuerdo.

La descripción completa de la base real (diagrama, diccionario de datos y scripts) está en [docs/arquitectura/base-de-datos.md](../docs/arquitectura/base-de-datos.md).
