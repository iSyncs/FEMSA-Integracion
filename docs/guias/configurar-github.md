# Configurar GitHub y Vercel

Pasos para dejar el repo funcionando de punta a punta. Se hacen una vez.

## 1. Repo y ramas

```bash
./scripts/configurar-repo.sh      # squash, merge commit, borrar ramas mergeadas
git checkout -b develop && git push -u origin develop
```

Quien administra el repo da acceso de escritura a los dos equipos (Settings, Collaborators). Los nombres de `.github/CODEOWNERS` deben tener acceso para que cuente la revisión.

## 2. Protección de ramas

Requiere repo público o plan de pago (en privado gratuito GitHub responde 403):

```bash
gh repo edit --visibility public --accept-visibility-change-consequences
./scripts/proteger-ramas.sh
```

Esto exige PR, 1 aprobación y el check **CI OK** en `main` y `develop`, y bloquea el push directo y el borrado.

## 3. Proyecto en Vercel

Es **un solo proyecto** con tres servicios ([ADR 0007](../decisiones/0007-un-solo-proyecto-de-vercel.md)). Se crea una vez:

1. Importa el repo en Vercel con **Root Directory** en la raíz del repo (no en una subcarpeta). Vercel lee los servicios del `vercel.json` de la raíz.
2. La integración Git queda apagada por `vercel.json` (`git.deploymentEnabled: false`): despliega GitHub Actions.
3. Carga las variables de la aplicación (Azure SQL, Blob Storage, OpenRouter, Gemini, `CRON_SECRET`...) en el proyecto de Vercel, **no** en GitHub. Las ven los servicios que las usan.

## 4. Secrets y variables de GitHub

Settings, Secrets and variables, Actions:

| Secret | Qué es |
|---|---|
| `VERCEL_TOKEN` | Token de Vercel con acceso al equipo |
| `VERCEL_ORG_ID` | ID del equipo o cuenta en Vercel |
| `VERCEL_PROJECT_ID` | ID del proyecto |

Variables (pestaña *Variables*, no son secretas). Solo sirven mientras un backend siga en su repo de origen (Fase 1); se borran cuando su código llegue aquí:

| Variable | Ejemplo | Efecto |
|---|---|---|
| `API_AUDITORIA_URL` | URL de producción actual del Equipo 2 | `/api/*` se manda a esa API |
| `API_RIESGOS_URL` | `https://femsa-audit-api.vercel.app` | `/api/maple/*` se manda a esa API |

Crea también los entornos `staging` y `production` (Settings, Environments). En `production` conviene pedir aprobación manual.

Mientras falte algún secret, el despliegue se omite con un aviso y el CI sigue en verde. Para ver qué se va a desplegar sin publicar nada:

```bash
node scripts/ajustar-vercel.mjs
```

## 5. Revisión

- Abre un PR de prueba y confirma que corren **Biome**, **Título del PR** y **CI OK**.
- Un título como `arreglo de cosas` debe fallar; `docs: probar CI` debe pasar.
- Cuando llegue la primera parte con código, confirma que su job aparece y se ejecuta.
