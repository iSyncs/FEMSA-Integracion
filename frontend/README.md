# frontend

Un solo sitio para toda la plataforma. Aquí se unen las pantallas del Equipo 2 (ejecución, cierre y seguimiento) y las del Equipo 11 "Maple" (planeación y riesgos).

**Estado:** vacío. El código llega por fases (ver [docs/arquitectura/integracion.md](../docs/arquitectura/integracion.md)).

## Reglas

- React 19 + Vite + Tailwind 4, escrito en **TypeScript** (`allowJs` mientras se migra el código del Equipo 2).
- Un módulo por dominio dentro de `src/features/`.
- Iconos: **Lucide**. Lint y formato: **Biome** (configuración en la raíz).
- Pruebas: Vitest para la lógica y Cypress para los flujos (con la API simulada).
- La app habla solo con `/api`; nunca ve credenciales.

## Estructura objetivo

```
frontend/
├─ src/
│  ├─ app/           router, layout, menú y proveedores (sesión, tema)
│  ├─ features/
│  │  ├─ auditoria/  pantallas del Equipo 2
│  │  ├─ riesgos/    pantallas de Maple (App Builder, riesgos, bandeja)
│  │  └─ compartido/ lo que usan ambos (bitácora, notificaciones)
│  └─ shared/        ui, hooks, lib y cliente de API
├─ cypress/          pruebas E2E
├─ public/
└─ vercel.json
```

## Comandos esperados

`npm run dev` · `npm run build` · `npm run check` · `npm run typecheck` · `npm test` · `npm run test:e2e`

El CI los corre solo si existen (ver [.github/workflows/ci.yml](../.github/workflows/ci.yml)).
