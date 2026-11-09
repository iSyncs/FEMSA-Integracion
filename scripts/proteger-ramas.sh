#!/usr/bin/env bash
# Protege main y develop: nadie hace push directo ni borra la rama, todo entra por PR con
# 1 aprobación y el job "CI OK" en verde.
#
# REQUISITO: GitHub solo permite esto en repos públicos o con plan de pago. En un repo privado
# gratuito responde 403. Para pasar el repo a público:
#   gh repo edit --visibility public --accept-visibility-change-consequences
#
# Uso: ./scripts/proteger-ramas.sh [dueno/repo]
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

gh api -X POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "Proteger main y develop",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main", "refs/heads/develop"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "CI OK" }]
      }
    }
  ]
}
JSON
echo "Protección activada en $REPO"
