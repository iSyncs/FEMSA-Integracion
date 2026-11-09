# FEMSA Integración

[![CI](https://github.com/iSyncs/FEMSA-Integracion/actions/workflows/ci.yml/badge.svg)](https://github.com/iSyncs/FEMSA-Integracion/actions/workflows/ci.yml)

Repositorio unido de la plataforma de **Auditoría Interna de FEMSA**, que sustituye a Archer IRM. Junta el trabajo de dos equipos del mismo proyecto:

| Equipo | Qué cubre | Repo de origen |
|---|---|---|
| Equipo 2 "Mesa para 7" | Ejecución, cierre y seguimiento de auditorías | `iSyncs/Femsa-equipo-2` |
| Equipo 11 "Maple" | Planeación, App Builder y riesgos | `EmilianoCBE/FEMSA-Audit` y `FEMSA-Audit-Backend` |

Juntos cubren el ciclo completo que pide la Visión de FEMSA.

**Estado:** esqueleto listo (carpetas, reglas y CI). El código se mueve por fases, ver [docs/arquitectura/integracion.md](docs/arquitectura/integracion.md).

## Mapa del repositorio

```
├─ frontend/            Un solo sitio (React + TypeScript) con las pantallas de los dos equipos
├─ backend-auditoria/   API NestJS del Equipo 2; abre y valida la sesión
├─ backend-riesgos/     API Express del Equipo 11
├─ db/                  Migraciones SQL numeradas de la base compartida (Azure SQL)
├─ docs/                Arquitectura, decisiones (ADR), guías y entregables
├─ scripts/             Utilidades del repo
└─ .github/             CI/CD, plantilla de PR, CODEOWNERS, Dependabot
```

Cada carpeta tiene su README con las reglas de esa parte.

## Cómo trabajamos

Resumen (detalle en [CONTRIBUTING.md](CONTRIBUTING.md)):

- Ramas: `main` (producción) y `develop` (staging). Se trabaja en `feature/HUxx-...` o `feature/USxx-...` y se abre PR a `develop`.
- Commits y títulos de PR: `tipo(ID): descripción`, por ejemplo `feat(HU05): crear solicitud PBC`.
- Cada PR necesita el CI en verde y **1 aprobación**. Se mergea con squash; las entregas `develop` a `main` usan merge commit.

## Integración y despliegue continuos

Todo corre en **GitHub Actions** ([.github/workflows](.github/workflows)):

| Evento | Qué pasa |
|---|---|
| PR a `develop` o `main` | Biome, título del PR, y por cada parte con código: tipos, pruebas y build |
| Merge a `develop` | Lo anterior y despliegue a **staging** en Vercel |
| Merge a `main` | Lo anterior y despliegue a **producción** en Vercel |

- El job **CI OK** resume todo y es el que se exige para mergear.
- Cada parte se valida y despliega solo cuando ya tiene su `package.json`.
- Las pruebas usan datos en memoria y una IA simulada: nunca tocan Azure ni gastan créditos.
- Los secrets y la puesta en marcha están en [docs/guias/configurar-github.md](docs/guias/configurar-github.md).

## Puesta en marcha

Requisito: Node.js 24 (`nvm use`).

```bash
npm ci
npm run check
```

Cada parte tendrá su propio `npm run dev` cuando llegue su código.

## Documentación

| Documento | Para qué sirve |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Ramas, commits, PR y definición de terminado |
| [docs/arquitectura/integracion.md](docs/arquitectura/integracion.md) | Cómo se unen los dos proyectos y las fases |
| [docs/decisiones/](docs/decisiones/README.md) | Decisiones tomadas y por qué |
| [docs/guias/configurar-github.md](docs/guias/configurar-github.md) | Secrets, Vercel y protección de ramas |
| [docs/pendientes.md](docs/pendientes.md) | Temas por revisar (por ejemplo LLMOps y agentes) |
| [db/README.md](db/README.md) | Reglas de la base compartida |

## Equipo

Equipo 2: Carlos Baranda (Scrum Master), Héctor Pablo González, Jorge García, Emilio Salas, Sebastián Sánchez, Manuel Cruz y Gabriel de la Vega.
Equipo 11 "Maple": Emiliano y Karla, entre otros.

Tecnológico de Monterrey · Planeación de Sistemas de Software · 2026
