# Cómo se unen los dos proyectos

## Idea general

Un solo dominio en Vercel. El navegador habla con un solo sitio y las rutas se reparten por prefijo.

```mermaid
flowchart LR
  U[Usuario] --> F["Frontend<br/>un solo sitio"]
  F -- "/api/*" --> A["backend-auditoria<br/>NestJS"]
  F -- "/api/maple/*" --> R["backend-riesgos<br/>Express"]
  A --> DB[("Azure SQL<br/>E12_FEMSA")]
  R --> DB
  A -. "abre sesión (cookie femsa_sesion)" .-> DB
  R -. "lee la sesión (USER_SESSION)" .-> DB
```

| Prefijo | Quién responde |
|---|---|
| `/` y `/auditorias/*`, `/hallazgos/*`, `/seguimiento/*`, `/ia/*` | Frontend (módulo auditoría) |
| `/maple/*` | Frontend (módulo riesgos) |
| `/api/maple/*` | `backend-riesgos` (le llega como `/api/*`, igual que en su repo) |
| `/api/*` (lo demás) | `backend-auditoria` |

Las tres partes son servicios de **un solo proyecto de Vercel** (`vercel.json` en la raíz, [ADR 0007](../decisiones/0007-un-solo-proyecto-de-vercel.md)). Se publican juntas en el mismo dominio, así la cookie de sesión sirve para todo y no hay CORS.

## Dos backends, una sola página

Para quien usa el sistema, la página se ve unificada por el dominio, el login, el menú y el diseño, no por la cantidad de servidores. Los backends se quedan separados por dominio de negocio, con estas reglas comunes:

1. **Misma sesión:** solo `backend-auditoria` inicia sesión; `backend-riesgos` la valida con la misma cookie y `USER_SESSION`.
2. **Mismos roles y permisos,** leídos de las mismas tablas.
3. **Cada equipo es dueño de sus tablas.** Si una parte necesita datos de la otra, el frontend los pide a la API dueña. Un backend no consulta por su cuenta las tablas del otro.
4. **Formato común:** un formato JSON de errores que acuerden los dos equipos, fechas en UTC y una sola bitácora (la del Equipo 2), donde los dos registran sus acciones.

## Qué aporta cada equipo

| Necesita | De quién viene |
|---|---|
| Auditorías y hallazgos | Equipo 2, lo consume Maple |
| Formularios y versiones (App Builder), riesgos (`RISK_LIBRARY`, `RISK_EVALUATION`), permisos por rol | Maple, lo consume el Equipo 2 |
| Bitácora | Equipo 2; Maple registra sus acciones en ella |
| Campana de notificaciones | Equipo 2; la bandeja de Maple es una lista de pendientes aparte |
| IA | Cada módulo conserva su proveedor (Equipo 2: OpenRouter o LM Studio; Maple: Gemini). Ver [pendientes](../pendientes.md) |

## Fases

**Fase 0 · esqueleto (hecha con este repo).** Carpetas, README de cada parte, reglas de trabajo, CI/CD, plantillas y decisiones. Sin código de producto.

**Fase 1 · frontend unido.**
1. Traer el frontend de Maple como base TypeScript (`features/riesgos`) y el del Equipo 2 como `features/auditoria`.
2. Un solo router y menú, con el login del Equipo 2.
3. Lucide como set de iconos.
4. Los backends siguen en sus repos de origen. Las variables `API_AUDITORIA_URL` y `API_RIESGOS_URL` mandan `/api/*` y `/api/maple/*` a sus despliegues actuales (ver [la guía](../guias/configurar-github.md)).
5. Primer despliegue a staging.

**Fase 2 · backends y base.**
1. Mover `backend/` del Equipo 2 a `backend-auditoria/` y pasar su código por Biome en un commit aparte.
2. Mover `FEMSA-Audit-Backend` a `backend-riesgos/` con el middleware de sesión única (ADR 0005).
3. Importar las migraciones de los dos equipos a `db/migrations/` con un orden común.
4. Despliegue de los tres proyectos desde Actions.

**Fase 3 · piezas compartidas.** Bitácora y campana unificadas, vista previa por PR, E2E sobre el sitio publicado, TypeScript completo en el frontend, y los temas de [pendientes](../pendientes.md).

## Riesgos conocidos
- Las dos APIs usan el prefijo `/api`: el reparto por `/api/maple/*` debe quedar antes que la regla general.
- Base compartida: una migración mal pensada rompe al otro equipo. Revisión cruzada obligatoria.
- Dos versiones de React Router (8 en el Equipo 2 y 7 en Maple): se fija una al unir el frontend.
- Backend en Vercel Hobby: tope de 50 imágenes por proyecto.
