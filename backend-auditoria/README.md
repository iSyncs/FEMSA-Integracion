# backend-auditoria

API del Equipo 2: auditorías, hallazgos, evidencias, solicitudes PBC, cierre y sellado, planes de remediación, bitácora, notificaciones, lotes de evidencia e IA. Es la API que **abre y valida la sesión** de toda la plataforma.

Viene de `iSyncs/Femsa-equipo-2` (carpeta `backend/`, rama `main` al 2026-11-10).

| Tecnología | Versión |
|---|---|
| Node.js | 24 (`.nvmrc` de la raíz) |
| NestJS | 12, ESM |
| TypeScript | 5.9 |
| Validación | class-validator |
| Documentación | Swagger en `/api/docs` |
| Pruebas | Jest 30 + Supertest |

## Ejecutar

```bash
cd backend-auditoria
npm install
npm run dev          # http://localhost:4000/api  ·  Swagger: http://localhost:4000/api/docs
npm test             # pruebas unitarias
npm run test:e2e     # pruebas de punta a punta de la API
npm run build        # compila a dist/
```

Sin `.env`, la API usa datos de demostración en memoria (se reinician al levantarla). La cuenta de demo es la de José Martínez; su contraseña local se define con `DEMO_PASSWORD` (ver `.env.example`).

## Arquitectura

```
src/
├── main.ts / configurar-app.ts   Arranque: prefijo /api, Helmet, validación, errores y Swagger
├── app.module.ts                 Registra un módulo por dominio
├── common/                       Validación de texto real, filtro de errores y utilidades
├── datos/                        Capa de datos
│   ├── repositorios/             Contratos (clases abstractas) por dominio
│   ├── memoria/                  Implementación en memoria + datos y PDF de demostración
│   ├── sql/                      Implementación para Azure SQL
│   └── datos.module.ts           Elige memoria o sql con DATA_SOURCE
├── auth/ · sistema/              Sesión, roles (@Roles), rutas públicas (@Publico) y seguridad por fila
├── auditorias/ · hallazgos/      Expediente de auditoría, evaluación de controles y hallazgos
├── evidencias/ · pbc/ · lotes/   Evidencias en Blob Storage, solicitudes PBC y lotes que analiza la IA
├── cierre/                       Pre-cierre, firmas Jefe → Gerente → Director y sellado SHA-256
├── planes/                       Planes de remediación, avances, semáforo y validación GRC
├── bitacora/ · notificaciones/   Bitácora de actividad y avisos de vencimiento (15/5/1 días)
├── reportes/                     Tablero e informe ejecutivo
└── ia/ · sugerencias-ia/         Proveedor de IA compatible con OpenAI y análisis guardados
```

**Flujo de una petición:** `Controller` (ruta, roles, DTO validado) → `Service` (reglas de negocio y seguridad por fila) → `Repository` abstracto → implementación en memoria o SQL.

**Sesión:** cookie HttpOnly `femsa_sesion` (8 horas). En `dbo.USER_SESSION` solo se guarda el SHA-256 del token. La API no acepta `X-Usuario-Id`; solo las pruebas lo usan, mediante `test/identificador-de-prueba.ts`.

**Seguridad por fila:** el Director ve todo; el auditado, solo sus auditorías; GRC, su unidad de negocio; el resto, su Dirección.

**Errores:** todas las respuestas de error tienen el formato `{ error, detalles? }`. Los 422 de validación traen `detalles` por campo.

## Base de datos (Azure SQL compartida)

| `DATA_SOURCE` | Fuente | Uso |
|---|---|---|
| `sql` | Azure SQL `E12_FEMSA` (`src/datos/sql/`) | Desarrollo con la base real y despliegue |
| *(sin definir)* | Datos de demostración en memoria | Pruebas automáticas y desarrollo sin base |

El esquema está en [`db/`](../db/README.md) en la raíz: la base compartida en `db/base/` y los cambios de esta API en `db/migrations/`.

Con `backend-auditoria/.env` lleno (ver `.env.example`):

```bash
npm run db:test                                              # comprueba la conexión y lista las tablas
npm run db:sql -- ../db/migrations/001-ampliacion-eq12.sql   # ejecuta un script (separado por GO)
npm run db:seed                                              # carga los datos de demostración
```

`db:seed -- --reiniciar` recarga los datos de demostración. Solo borra datos del Equipo 2 (usuarios `@demo.femsa.test` y tablas del equipo), nunca filas de Maple.

Azure SQL serverless puede tardar hasta un minuto en responder la primera consulta después de estar en pausa.

## Evidencias e IA

- Evidencias en Azure Blob Storage: reglas de seguridad y configuración en [src/evidencias/README.md](src/evidencias/README.md).
- Proveedor de IA y prompts: [src/ia/README.md](src/ia/README.md) y [src/sugerencias-ia/README.md](src/sugerencias-ia/README.md).
- Generador de las evidencias PDF simuladas: [herramientas/evidencias-ia/](herramientas/evidencias-ia/).

## Despliegue

Se publica como servicio `auditoria` (contenedor, `Dockerfile`) del proyecto único de Vercel, bajo `/api/*`. El cron diario `/api/notificaciones/cron/vencimientos` necesita `CRON_SECRET`. Las claves viven en Vercel, nunca en el repo.

Vercel guarda una imagen por despliegue y el plan Hobby admite 50. Si un despliegue falla por ese límite: `./scripts/limpiar-imagenes-vercel.sh 15 --si` desde la raíz.

## Reglas

- Un módulo por dominio en `src/`. Para agregar uno: contrato en `datos/repositorios/`, implementación en `memoria/` y en `sql/`, registro en `datos.module.ts` (lista `IMPLEMENTACIONES`) y en `app.module.ts`.
- Los campos obligatorios usan `@TextoSignificativo`; las rutas declaran `@Roles(...)`.
- Cada cambio de esquema es una migración nueva en `db/migrations/`.
- El CI corre tipos, pruebas unitarias, e2e y build con `DATA_SOURCE=memoria` y una IA simulada: nunca toca Azure.
