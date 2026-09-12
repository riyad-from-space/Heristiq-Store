#!/usr/bin/env bash
#
# Ship both apps to Cloudflare Workers, secrets included.
#
#   ./scripts/deploy.sh            both apps
#   ./scripts/deploy.sh store      just the storefront
#   ./scripts/deploy.sh erp        just the ERP
#   ./scripts/deploy.sh secrets    sync secrets only, no build or deploy
#
# WHY THIS EXISTS. Three separate things are easy to get wrong and each one
# produces a site that looks deployed and is broken:
#
#   NEXT_PUBLIC_ERP_URL   .env.local points it at localhost:3001 for dev. Ship
#                         that and the footer's "Owner sign-in" link sends
#                         customers to a machine that is not on the internet.
#
#   ERP_BASE_PATH=        next.config.ts defaults basePath to "/admin", for the
#                         day the ERP sits under heristiq.com/admin. The ERP is
#                         on its own workers.dev hostname, where that prefix
#                         must be EMPTY — otherwise every URL moves to
#                         /admin/... and the owner's bookmark 404s.
#
#   STOREFRONT_URL        also localhost in .env.local. The ERP calls the
#                         storefront's ship endpoint over the public internet,
#                         so a localhost value means "Send to courier" reaches
#                         the Worker's own loopback and fails.
#
# The first two are inlined at BUILD time, so neither is fixable afterwards and
# neither fails a typecheck. All three are encoded here so nobody has to
# remember them.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
TARGET="${1:-both}"

STORE_URL="https://heristiq-store.heristiq.workers.dev"
ERP_URL="https://heristiq-erp.heristiq.workers.dev"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
note() { printf '    %s\n' "$1"; }

# ---------------------------------------------------------------- secrets --
#
# Values are read from each app's .env.local and piped to `wrangler secret put`
# on stdin — never typed, never in a shell history, and never passed as an
# argument, which `ps` would show to every process on the machine.
#
# NEXT_PUBLIC_* are deliberately absent. Those are inlined into the bundle at
# build time; setting them as Worker secrets does nothing at all and invites
# the belief that changing one is a secret update rather than a rebuild.

# Everything the storefront reads at RUNTIME. Cloudinary's key and secret are
# NOT here: the storefront only ever builds delivery URLs, which need the cloud
# name alone (a NEXT_PUBLIC_, inlined). Uploading is the ERP's job.
STORE_SECRETS="
STOREFRONT_SECRET
ADMIN_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PATHAO_CLIENT_ID
PATHAO_CLIENT_SECRET
PATHAO_USERNAME
PATHAO_PASSWORD
PATHAO_STORE_ID
PATHAO_SENDER_NAME
PATHAO_SENDER_PHONE
PATHAO_ENVIRONMENT
PATHAO_ITEM_WEIGHT
PATHAO_WEBHOOK_SECRET
COURIER_DEFAULT
COURIER_DELIVERY_TYPE
"

ERP_SECRETS="
ADMIN_TOKEN
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_FOLDER
ERP_ADMIN_EMAILS
"

# Read one value out of an app's .env.local without sourcing the file — a
# `source` would execute whatever is in there and would also mangle a value
# containing a `#`, which is how a database password got silently truncated
# earlier in this project.
read_env() {
  local app="$1" key="$2" raw
  raw="$(sed -n "s/^${key}=//p" "$ROOT/apps/$app/.env.local" 2>/dev/null | head -1)"

  # Strip one layer of surrounding quotes, because dotenv does and Next does —
  # a value written as 'p#ss' must reach Cloudflare as p#ss, not as 'p#ss'.
  # Quoting is what the comments in .env.local tell the owner to do for any
  # value containing # or $, so this is the normal case, not an edge one.
  case "$raw" in
    \'*\') raw="${raw#\'}"; raw="${raw%\'}" ;;
    '"'*'"') raw="${raw#\"}"; raw="${raw%\"}" ;;
  esac
  printf '%s' "$raw"
}

put_secret() {
  local app="$1" key="$2" value="$3"
  printf '%s' "$value" | (cd "$ROOT/apps/$app" && npx wrangler secret put "$key" >/dev/null)
}

sync_secrets() {
  local app="$1" names="$2" set=0 skipped=""

  if [ ! -f "$ROOT/apps/$app/.env.local" ]; then
    note "no apps/$app/.env.local — skipping secrets"
    return
  fi

  for key in $names; do
    local value
    value="$(read_env "$app" "$key")"
    if [ -z "$value" ]; then
      skipped="$skipped $key"
      continue
    fi
    put_secret "$app" "$key" "$value"
    set=$((set + 1))
  done

  # STOREFRONT_URL is the one value that must NOT come from .env.local, where
  # it points at localhost for development.
  if [ "$app" = "erp" ]; then
    put_secret erp STOREFRONT_URL "$STORE_URL"
    set=$((set + 1))
    note "STOREFRONT_URL -> $STORE_URL (overriding the localhost value)"
  fi

  note "$set secret(s) set"
  [ -n "$skipped" ] && note "empty, left unset:$skipped"
  return 0
}

# The ERP authenticates to the storefront's ship endpoint with ADMIN_TOKEN. If
# the two differ, "Send to courier" fails with a 401 that names neither side.
check_admin_token() {
  local a b
  a="$(read_env store ADMIN_TOKEN)"
  b="$(read_env erp ADMIN_TOKEN)"
  if [ -z "$a" ] || [ -z "$b" ]; then
    note "WARNING: ADMIN_TOKEN missing on one side — courier push will not work"
  elif [ "$a" != "$b" ]; then
    note "WARNING: the two ADMIN_TOKENs differ — courier push will 401"
  fi
}

# ----------------------------------------------------------------- deploys --

deploy_store() {
  step "Storefront: secrets"
  sync_secrets store "$STORE_SECRETS"

  step "Storefront: build"
  cd "$ROOT/apps/store"
  rm -rf .next .open-next
  NEXT_PUBLIC_ERP_URL="$ERP_URL" npx opennextjs-cloudflare build

  step "Storefront: deploy"
  npx wrangler deploy
}

deploy_erp() {
  step "ERP: secrets"
  sync_secrets erp "$ERP_SECRETS"

  step "ERP: build"
  cd "$ROOT/apps/erp"
  rm -rf .next .open-next
  ERP_BASE_PATH= npx opennextjs-cloudflare build

  step "ERP: deploy"
  npx wrangler deploy
}

check_admin_token

case "$TARGET" in
  store) deploy_store ;;
  erp)   deploy_erp ;;
  both)  deploy_store; deploy_erp ;;
  secrets)
    step "Storefront: secrets"; sync_secrets store "$STORE_SECRETS"
    step "ERP: secrets";        sync_secrets erp   "$ERP_SECRETS"
    ;;
  *) echo "usage: $0 [store|erp|both|secrets]" >&2; exit 1 ;;
esac

step "Done"
echo "  storefront  $STORE_URL"
echo "  ERP         $ERP_URL"
echo
echo "  Courier push is manual: open an order in the ERP and press Send to"
echo "  courier. Check the Pathao zone on the first few — the address matcher"
echo "  guesses, and a wrong guess is a misrouted parcel."
