#!/usr/bin/env bash
#
# Ship both apps to Cloudflare Workers.
#
#   ./scripts/deploy.sh            both apps
#   ./scripts/deploy.sh store      just the storefront
#   ./scripts/deploy.sh erp        just the ERP
#
# WHY THIS EXISTS. Both apps need a build-time variable that is wrong by
# default, and getting either one wrong produces a site that looks deployed and
# is broken:
#
#   NEXT_PUBLIC_ERP_URL   .env.local points it at localhost:3001 for dev. Ship
#                         that and the footer's "Owner sign-in" link sends
#                         customers to a machine that is not on the internet.
#
#   ERP_BASE_PATH=        next.config.ts defaults basePath to "/admin", for the
#                         day the ERP sits under heristiq.com/admin. The ERP is
#                         currently on its own workers.dev hostname, where that
#                         prefix must be EMPTY — otherwise every URL moves to
#                         /admin/... and the owner's bookmark 404s.
#
# Both are inlined at BUILD time, so neither can be fixed after the fact and
# neither shows up in a typecheck. They are encoded here so nobody has to
# remember them.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
TARGET="${1:-both}"

ERP_URL="https://heristiq-erp.heristiq.workers.dev"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

deploy_store() {
  step "Storefront: build"
  cd "$ROOT/apps/store"
  rm -rf .next .open-next
  NEXT_PUBLIC_ERP_URL="$ERP_URL" npx opennextjs-cloudflare build

  step "Storefront: deploy"
  npx wrangler deploy
}

# The ERP's Cloudinary credentials, pushed as Worker secrets.
#
# Read from apps/erp/.env.local rather than typed, so the values never land in
# a shell history, a log or a chat. `wrangler secret put` reads stdin when it
# is not a terminal, so the pipe keeps them off the command line too — an
# argument would be visible in `ps` to every process on the machine.
sync_erp_secrets() {
  step "ERP: sync Cloudinary secrets"
  cd "$ROOT/apps/erp"

  if [ ! -f .env.local ]; then
    echo "  no apps/erp/.env.local — skipping secrets"
    return
  fi

  set -a; . ./.env.local; set +a

  for name in CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET; do
    value="${!name:-}"
    if [ -z "$value" ]; then
      echo "  $name is empty — photograph uploads will be off in production"
      continue
    fi
    printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
    echo "  $name set"
  done
}

deploy_erp() {
  sync_erp_secrets

  step "ERP: build"
  cd "$ROOT/apps/erp"
  rm -rf .next .open-next
  ERP_BASE_PATH= npx opennextjs-cloudflare build

  step "ERP: deploy"
  npx wrangler deploy
}

case "$TARGET" in
  store) deploy_store ;;
  erp)   deploy_erp ;;
  both)  deploy_store; deploy_erp ;;
  *)     echo "usage: $0 [store|erp|both]" >&2; exit 1 ;;
esac

step "Done"
echo "  storefront  https://heristiq-store.heristiq.workers.dev"
echo "  ERP         $ERP_URL"
