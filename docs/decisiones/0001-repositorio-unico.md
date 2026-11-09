# 0001 · Un repositorio nuevo, monorepo

**Fecha:** 2026-11-09 · **Estado:** Aceptada

## Contexto
Los dos equipos tienen repos separados (`Femsa-equipo-2`, `FEMSA-Audit` y `FEMSA-Audit-Backend`) y hay que entregar una sola página. Tocar el repo de uno de los equipos dejaría al otro como invitado.

## Decisión
Se crea `FEMSA-Integracion`, un repo nuevo y neutral, organizado como monorepo con carpetas independientes: `frontend`, `backend-auditoria`, `backend-riesgos` y `db`. Cada carpeta tiene su propio `package.json`; no se usan workspaces de npm por ahora.

## Consecuencias
- Un solo lugar para revisar PR, CI, migraciones y despliegues.
- Los dos backends siguen separados (distinta tecnología) detrás del mismo dominio.
- El historial de los repos de origen no se importa: el código se copia por fases y los repos viejos quedan como archivo.
- El repo empieza **privado** porque GitHub gratuito no protege ramas en repos privados. Pasarlo a público (o a una organización) permite exigir CI y aprobaciones con `scripts/proteger-ramas.sh`.
