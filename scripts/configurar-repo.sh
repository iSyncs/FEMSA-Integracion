#!/usr/bin/env bash
# Ajusta las opciones de merge del repositorio: squash para las ramas de trabajo, merge commit para
# las entregas (develop a main), sin rebase, y borra la rama al mergear.
# Uso: ./scripts/configurar-repo.sh [dueno/repo]   (por omisión, el repo de la carpeta actual)
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=true \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=false \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=BLANK \
  --jq '{full_name, private, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'
