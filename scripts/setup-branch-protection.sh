#!/usr/bin/env bash
#
# Protect `main` with a GitHub ruleset: changes arrive by pull request, CI must
# pass, and history cannot be rewritten or the branch deleted.
#
# Zero required approvals by default, so whoever opens a PR can merge it once CI
# is green. Pass --approvals 1 when code review starts; nothing else changes.
#
# Rulesets are used rather than classic branch protection because they work on
# private repositories on every plan.
#
# Run once, by a repository admin:
#     ./scripts/setup-branch-protection.sh
#     ./scripts/setup-branch-protection.sh --approvals 1   # when review starts
#
set -euo pipefail

REPO="${REPO:-DorFerenc/Kenn}"
APPROVALS=0
RULESET_NAME="main"

while [ $# -gt 0 ]; do
  case "$1" in
    --approvals) APPROVALS="${2:?--approvals needs a number}"; shift 2 ;;
    --repo)      REPO="${2:?--repo needs owner/name}";        shift 2 ;;
    -h|--help)   sed -n '2,20p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null 2>&1 || {
  printf 'gh is not installed. See https://cli.github.com\n' >&2; exit 1; }

printf 'Protecting the default branch of %s (required approvals: %s)\n' "$REPO" "$APPROVALS"

# The two contexts below are the `name:` of each job in .github/workflows/ci.yml.
# Renaming a job there means renaming it here, or the check stops being required.
payload=$(cat <<JSON
{
  "name": "${RULESET_NAME}",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": ${APPROVALS},
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash", "merge"]
      } },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Typecheck, lint and test" },
          { "context": "Gov watcher (Python)" }
        ]
      } }
  ]
}
JSON
)

existing=$(gh api "repos/${REPO}/rulesets" --jq \
  ".[] | select(.name==\"${RULESET_NAME}\") | .id" 2>/dev/null || true)

if [ -n "$existing" ]; then
  printf 'Updating existing ruleset %s\n' "$existing"
  printf '%s' "$payload" | gh api -X PUT "repos/${REPO}/rulesets/${existing}" --input -
else
  printf 'Creating ruleset\n'
  printf '%s' "$payload" | gh api -X POST "repos/${REPO}/rulesets" --input -
fi

printf '\nDone. Verify with:\n  gh api repos/%s/rulesets --jq ".[].name"\n' "$REPO"
printf '\nAlso worth turning on in Settings, which this script cannot set:\n'
printf '  - Security and analysis: secret scanning + push protection\n'
printf '  - Security and analysis: Dependabot alerts\n'
printf '  - Pull requests: auto-delete head branches after merge\n'
