# scripts

Utilidades del repositorio. Se corren desde la raíz: `./scripts/nombre.sh`. Cada una explica su uso en las primeras líneas.

| Script | Para qué sirve |
|---|---|
| `configurar-repo.sh` | Ajusta las opciones de merge del repo (squash y merge commit, borrar ramas mergeadas). |
| `proteger-ramas.sh` | Protege `main` y `develop` (PR con 1 aprobación y CI en verde). Requiere repo público o plan de pago. |
