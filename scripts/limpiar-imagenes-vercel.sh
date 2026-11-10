#!/usr/bin/env bash
# Vercel guarda una imagen del servicio de contenedor (la API de auditoría) por cada despliegue y el plan Hobby admite 50.
# Este script deja las N más recientes (15 por omisión) y borra las demás.
# Uso: ./scripts/limpiar-imagenes-vercel.sh [cuantas_conservar] [--si]
# El servicio se elige con SERVICIO (por omisión, "auditoria", el nombre en vercel.json).
# Sin --si solo muestra lo que borraría.
set -euo pipefail
CONSERVAR="${1:-15}"
CONFIRMAR="${2:-}"
SERVICIO="${SERVICIO:-auditoria}"

ids=$(vercel vcr image ls "$SERVICIO" --limit 100 --format json 2>/dev/null \
  | node -e 'let t="";process.stdin.on("data",d=>t+=d).on("end",()=>{const n=+process.argv[1];const im=JSON.parse(t).images.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));im.slice(n).forEach(i=>console.log(i.id+" "+i.createdAt.slice(0,10)))})' "$CONSERVAR")

if [ -z "$ids" ]; then echo "Hay $CONSERVAR imágenes o menos; no hay nada que borrar."; exit 0; fi
echo "Imágenes que se borrarían (se conservan las $CONSERVAR más recientes):"
echo "$ids"
if [ "$CONFIRMAR" != "--si" ]; then echo "Vuelve a correrlo con --si para borrarlas."; exit 0; fi
echo "$ids" | while read -r id _; do vercel vcr image rm "$SERVICIO" "$id" --yes >/dev/null && echo "borrada $id"; done
