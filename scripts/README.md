# scripts

Utilidades del repositorio. Se corren desde la raíz: `./scripts/nombre.sh`. Cada una explica su uso en las primeras líneas.

| Script | Para qué sirve |
|---|---|
| `ajustar-vercel.mjs` | Lo usa el despliegue: deja en `vercel.json` solo las partes con código. Sin `--escribir`, solo muestra el resultado. |
| `configurar-repo.sh` | Ajusta las opciones de merge del repo (squash y merge commit, borrar ramas mergeadas). |
| `proteger-ramas.sh` | Protege `main` y `develop` (PR con 1 aprobación y CI en verde). Requiere repo público o plan de pago. |
