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

## 3. Proyectos en Vercel

Crea tres proyectos y, en cada uno, configura **Root Directory** y desactiva la integración Git (el despliegue lo hace Actions):

| Proyecto | Root Directory | Secret del repo con su ID |
|---|---|---|
| frontend | `frontend` | `VERCEL_PROJECT_ID_FRONTEND` |
| API de auditoría | `backend-auditoria` | `VERCEL_PROJECT_ID_AUDITORIA` |
| API de riesgos | `backend-riesgos` | `VERCEL_PROJECT_ID_RIESGOS` |

Variables de la aplicación (Azure, OpenRouter, Gemini, etc.) se cargan en cada proyecto de Vercel, **no** en GitHub.

## 4. Secrets de GitHub

Settings, Secrets and variables, Actions:

| Secret | Qué es |
|---|---|
| `VERCEL_TOKEN` | Token de Vercel con acceso al equipo |
| `VERCEL_ORG_ID` | ID del equipo o cuenta en Vercel |
| `VERCEL_PROJECT_ID_FRONTEND`, `_AUDITORIA`, `_RIESGOS` | IDs de los tres proyectos |

Crea también los entornos `staging` y `production` (Settings, Environments). En `production` conviene pedir aprobación manual.

Mientras falte algún secret, el despliegue de esa parte se omite con un aviso y el CI sigue en verde.

## 5. Revisión

- Abre un PR de prueba y confirma que corren **Biome**, **Título del PR** y **CI OK**.
- Un título como `arreglo de cosas` debe fallar; `docs: probar CI` debe pasar.
- Cuando llegue la primera parte con código, confirma que su job aparece y se ejecuta.
