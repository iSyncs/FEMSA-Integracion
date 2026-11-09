# Cómo trabajamos

Reglas del Equipo 11 "Maple" adoptadas para todo el repositorio. Aplican a las tres partes: `frontend`, `backend-auditoria` y `backend-riesgos`.

## Ramas

| Rama | Para qué | Quién escribe |
| --- | --- | --- |
| `main` | Lo que se entrega y se muestra en demo. Es **producción**. | Solo PR desde `develop` (o `hotfix/*`) |
| `develop` | Integración del sprint. Es **staging**. | Solo PR desde ramas de trabajo |
| `feature/HUxx-descripcion` | Una historia del Equipo 2. Ej. `feature/HU05-solicitudes-pbc` | Su responsable |
| `feature/USxx-descripcion` | Una historia del Equipo 11. Ej. `feature/US08-notificaciones-topbar` | Su responsable |
| `fix/descripcion` | Corregir un bug encontrado en `develop` | Cualquiera |
| `chore/descripcion` | Configuración, dependencias, CI, documentación | Cualquiera |
| `hotfix/descripcion` | Bug urgente en `main` | Con aviso al equipo |

Las historias de cada equipo conservan su numeración (`HU` es del Equipo 2 y `US` es de Maple) porque los números se repiten entre equipos. No se hace push directo a `main` ni a `develop`.

## Flujo de una historia

```bash
# 1. Empezar SIEMPRE desde develop actualizado
git checkout develop
git pull
git checkout -b feature/HU05-solicitudes-pbc

# 2. Trabajar con commits pequeños y subirlos seguido
git add <archivos>
git commit -m "feat(HU05): crear solicitud PBC con fecha límite"
git push -u origin feature/HU05-solicitudes-pbc

# 3. Cada vez que se mergee algo a develop, traerlo a tu rama
git checkout develop && git pull
git checkout feature/HU05-solicitudes-pbc
git merge develop
git push
```

4. Antes de abrir el PR, correr lo mismo que corre el CI (ver abajo).
5. Abrir un **Pull Request hacia `develop`**, llenar la plantilla y pedir revisión.
6. Esperar el CI en verde y **1 aprobación**. Atender comentarios con nuevos commits en la misma rama.
7. Se mergea con **Squash and merge** (un commit por historia) y se **borra la rama**.
8. Para la siguiente historia, rama nueva desde `develop`. No se reutilizan ramas ya mergeadas.

Se usa `git merge develop`, **no** `git rebase`: las ramas ya están en GitHub y rebase obligaría a hacer `push --force`.

## Commits

Formato: `tipo(ID): descripción en presente`. El `(ID)` es la historia (`HU05`, `US08`) y es opcional si no aplica.

| Tipo | Uso |
| --- | --- |
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de bug |
| `test` | Agregar o corregir pruebas |
| `refactor` | Cambiar código sin cambiar comportamiento |
| `docs` | Documentación |
| `chore` | Configuración, dependencias, CI |

Ejemplos: `feat(HU05): crear solicitud PBC`, `fix(US07): calcular nivel de riesgo`, `chore: actualizar Biome`.

## Pull Requests

- El **título** sigue el mismo formato que los commits (`tipo(ID): descripción`), porque al hacer squash se vuelve el commit en `develop`. El CI lo revisa.
- Un PR = una historia (o un fix). Los PR chicos se revisan rápido; los gigantes se atoran.
- Incluye pruebas de lo que agrega (ver "Definición de terminado").
- Quien revisa comprueba que funcione, que siga la arquitectura y que no rompa otras pantallas. Aprobar sin revisar no cuenta.
- Si GitHub dice *"This branch has conflicts"*, quien abrió el PR hace el paso 3 del flujo.
- Los cambios de `db/migrations/` que tocan tablas compartidas los revisa alguien del otro equipo (ver [db/README.md](db/README.md)).

## Antes de abrir un PR

Desde la raíz:

```bash
npm ci
npm run check          # Biome: lint y formato, igual que el CI
```

Y en la carpeta que tocaste:

| Carpeta | Comandos |
| --- | --- |
| `frontend/` | `npm run typecheck` · `npm test` · `npm run build` · `npm run test:e2e` |
| `backend-auditoria/` | `npx tsc --noEmit` · `npm test` · `npm run test:e2e` · `npm run build` |
| `backend-riesgos/` | `npm test` |

Recomendado: extensión **Biome** en VS Code con "Format on Save".

## Entregas (develop a main)

Al cerrar cada sprint o antes de una demo, se abre un PR de `develop` a `main` titulado `chore: release sprint N`. Se revisa que todo funcione en conjunto y se mergea con **Create a merge commit** (no squash).

**Hotfix:** rama `hotfix/...` desde `main`, PR a `main` y después un PR de `main` a `develop` para no perder el arreglo.

## Definición de terminado

- [ ] Cumple los criterios de aceptación de la historia.
- [ ] Tiene pruebas: unitarias para la lógica nueva y, si cambia una pantalla o flujo, una prueba E2E.
- [ ] El CI está en verde.
- [ ] Otra persona la revisó y aprobó.
- [ ] Si agrega variables de entorno, están en `.env.example`; si agrega endpoints, están en el README de su carpeta.
- [ ] Si cambia la base, hay migración numerada en `db/migrations/`.
- [ ] Está mergeada en `develop`.

## Secretos

Nunca se sube un `.env`, una contraseña, una clave ni un token. Las claves viven en las variables de Vercel y en los *secrets* de GitHub. El CI falla si encuentra un `.env` versionado.
