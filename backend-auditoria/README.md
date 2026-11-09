# backend-auditoria

API del Equipo 2: auditorías, hallazgos, evidencias, PBC, cierre y sellado, planes de remediación, bitácora, notificaciones, lotes e IA. Es la API que **abre y valida la sesión** de toda la plataforma.

**Estado:** vacío. Se mueve desde `iSyncs/Femsa-equipo-2` (carpeta `backend/`) en la Fase 2.

## Reglas

- NestJS 12 + TypeScript, ESM. Un módulo por dominio en `src/`.
- Patrón de datos: repositorio abstracto con dos implementaciones, `memoria` (local y pruebas) y `sql` (Azure). Se elige con `DATA_SOURCE=memoria|sql`.
- Pruebas: Jest (unitarias y e2e). El CI usa `DATA_SOURCE=memoria` y una IA simulada: nunca toca Azure.
- Sesión: cookie HttpOnly `femsa_sesion` y tabla `USER_SESSION` (solo se guarda el SHA-256 del token).
- Variables en `.env.example`; las claves reales viven en Vercel.

## Comandos esperados

`npm run dev` · `npm test` · `npm run test:e2e` · `npm run build`
