# backend-riesgos

API del Equipo 11 "Maple": App Builder (diseñador con versiones), evaluación y biblioteca de riesgos, usuarios y recomendaciones con IA.

**Estado:** vacío. Se mueve desde `EmilianoCBE/FEMSA-Audit-Backend` después de la presentación (Fase 2).

## Reglas

- Express 5 + JavaScript (ESM). Capas: `routes`, `controllers`, `services`, `repositories`, `models`.
- Pruebas con `node --test`. Lint y formato con Biome (configuración en la raíz).
- Se publica bajo `/api/maple/*`, pero Vercel le entrega la ruta como `/api/*`, así que sus rutas no cambian. No lleva `vercel.json` propio (lo maneja el de la raíz).
- **No abre sesiones propias**: lee la cookie `femsa_sesion` y busca el token en `USER_SESSION` (ver [ADR 0005](../docs/decisiones/0005-sesion-unica.md)).
- Sus migraciones se mueven a `db/migrations/` con el orden común.
- Proveedor de IA propio (Gemini, variable `AI_PROVIDER`).
