# 0007 · Un solo proyecto de Vercel

**Fecha:** 2026-11-09 · **Estado:** Aceptada · Reemplaza la parte de despliegue por proyectos de la [0004](0004-ci-cd-con-github-actions.md)

## Contexto
La 0004 dejó tres proyectos de Vercel (uno por parte), como lo hace Maple. Eso da tres dominios distintos. La página tiene que verse y funcionar como una sola: un login y una cookie de sesión para todo. Con tres dominios, la cookie no llega a las tres partes sin redirecciones entre proyectos, y una pantalla nueva podía publicarse antes que la API que necesita.

## Decisión
- Un solo proyecto de Vercel con **Vercel Services**: el `vercel.json` de la raíz declara tres servicios (`frontend`, `auditoria` y `riesgos`).
- Las rutas públicas, en este orden:
  1. `/api/maple/*` va a `riesgos`, que la recibe como `/api/*`, igual que hoy en su repo.
  2. `/api/*` va a `auditoria`.
  3. Todo lo demás va a `frontend`.
- Cada despliegue publica las tres partes juntas. Un merge a `develop` va a staging y un merge a `main` va a producción, siempre desde GitHub Actions.
- `scripts/ajustar-vercel.mjs` quita, antes de construir, los servicios que todavía no tienen código. Mientras los backends sigan en sus repos de origen, las variables `API_AUDITORIA_URL` y `API_RIESGOS_URL` mandan sus rutas a esos despliegues.
- Los crons viajan con su API: si la API vive afuera, su cron no se repite aquí.

## Consecuencias
- Un dominio, una cookie, sin CORS y sin desfase entre pantallas y APIs.
- Revertir un despliegue revierte las tres partes juntas. No se puede publicar una sola parte por separado. Para este proyecto es lo deseado.
- Solo hacen falta tres secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`.
- El backend de auditoría es un contenedor. Vercel Hobby guarda hasta 50 imágenes por proyecto y hay que limpiarlas (script del Equipo 2, se trae en la Fase 2).
