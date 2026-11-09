# db

La base es **una sola**: Azure SQL `E12_FEMSA`, compartida por los dos equipos. Cualquier cambio de esquema puede romper al otro equipo, por eso todo pasa por aquí.

## Reglas

- Todo cambio de esquema es un archivo numerado en [`migrations/`](migrations/README.md). Nunca se edita una migración ya aplicada: se agrega otra.
- Toda migración que toque `USER`, `ROLE`, permisos o unidades de negocio la revisa **alguien del otro equipo**.
- Las migraciones deben poder correrse dos veces sin error (`IF NOT EXISTS`).
- Aplicar en Azure es manual y lo hace quien administra la base (Carlos). Se avisa en el PR antes de aplicar.
- Nada de datos reales ni contraseñas en este repo.

## Tablas que tocan los dos equipos

`USER`, `ROLE`, `PERMISSION`, `ROLE_PERMISSION`, `APPLICATION_USER_ROLE`, `USER_SESSION` y las unidades de negocio. Los dos equipos usan **los mismos roles**; nadie agrega roles propios sin acuerdo.
