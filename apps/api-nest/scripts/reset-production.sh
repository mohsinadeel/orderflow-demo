#!/usr/bin/env bash
set -euo pipefail

API_PATH=/home6/inceptio/demo.mohsinadeel.dev/orderflow-api
NODE_ENV_PATH=/home6/inceptio/nodevenv/demo.mohsinadeel.dev/orderflow-api/22/bin/activate

test -d "$API_PATH"
test -f "$API_PATH/.env"
test -f "$NODE_ENV_PATH"

# CloudLinux's generated activation script reads optional unset variables.
set +u
source "$NODE_ENV_PATH"
set -u
cd "$API_PATH"
set -a
source ./.env
set +a

test "${DB_TABLE_PREFIX:-}" = orderflow_
export ORDERFLOW_RESET_CONFIRMATION=RESET-ORDERFLOW-DATA
npm run reset:data
