# Deployment preparation

Target origin: `https://demo.mohsinadeel.dev`

- Operator interface: `/orderflow-demo`
- NestJS API, Swagger and GraphQL: `/orderflow-api`
- Runtime: cPanel CloudLinux Node.js `22.23.5`, production mode, Passenger
- Database: the existing shared MySQL database with OrderFlow-owned tables prefixed `orderflow_`

Express and the isolated inventory service are comparison/experiment implementations and are not part of the hosted topology.

## One-time cPanel applications

Create these applications before the first workflow run:

| Application | Root | URL | Startup file |
| --- | --- | --- | --- |
| NestJS API | `demo.mohsinadeel.dev/orderflow-api` | `demo.mohsinadeel.dev/orderflow-api` | `passenger.cjs` |
| Next.js UI | `demo.mohsinadeel.dev/orderflow-demo` | `demo.mohsinadeel.dev/orderflow-demo` | `passenger.cjs` |

Use Node `22.23.5`, production mode, and separate Passenger logs under `/home6/inceptio/logs/`. Do not create either application until the release artefacts and server environment files are ready.

CloudLinux created the API virtual environment at `/home6/inceptio/nodevenv/demo.mohsinadeel.dev/orderflow-api/22`; the deployment workflow validates that exact generated path before changing application files.

The API root requires an owner-readable `.env` containing the established shared database connection plus:

```dotenv
NODE_ENV=production
DB_TABLE_PREFIX=orderflow_
ORDERFLOW_BASE_PATH=/orderflow-api
ORDERFLOW_PUBLIC_API_URL=https://demo.mohsinadeel.dev/orderflow-api
TRUST_PROXY_HOPS=1
```

The UI root requires:

```dotenv
NODE_ENV=production
ORDERFLOW_BASE_PATH=/orderflow-demo
ORDERFLOW_API_URL=https://demo.mohsinadeel.dev/orderflow-api
ORDERFLOW_PUBLIC_API_URL=https://demo.mohsinadeel.dev/orderflow-api
```

The files must remain outside Git and use owner-only permissions. The API migration command validates `DB_TABLE_PREFIX` before constructing identifiers. It creates only the four `orderflow_` tables and inserts the three synthetic catalogue fixtures when absent; it does not create or alter shared users.

Because the API is intentionally anonymous, the manual-only `Operate OrderFlow production` workflow manages a daily reset at 03:17 server time. Its marked crontab entry invokes `scripts/reset-production.sh`, which validates the exact application path and requires `DB_TABLE_PREFIX=orderflow_` before setting the reset confirmation. The underlying command deletes reservations, items, orders and products in foreign-key order, then restores the three fixtures. Run the hosted smoke and bounded concurrency verification before installing the cron; use the workflow's `reset-now` operation once to verify the hosted reset before relying on its schedule.

## GitHub configuration

The manual-only workflow `.github/workflows/deploy.yml` uses the same VPN and SSH model as the existing demos. Configure the OrderFlow repository's `production` environment with:

- Secrets: `OPENVPN_CONFIG`, `VPN_USERNAME`, `VPN_PASSWORD`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SSH_PORT`, `SSH_USERNAME`
- Variable: `SSH_HOST`

Repository-level Actions secrets are available to the `production` job. Run `scripts/Set-DeploymentSecrets.ps1` interactively to enter the seven values from their original sources without placing them in command arguments or files. GitHub does not allow encrypted values to be copied back out of another repository.

The workflow builds and tests NestJS against a prefixed CI schema, builds the Next.js standalone application for `/orderflow-demo`, uploads both artefacts, preserves the server `.env` files, runs the production migration, restarts Passenger through `tmp/restart.txt`, and checks the two public endpoints.

The first successful production deployment was GitHub Actions run `43289510877` from commit `a5fc965` on 13 November 2026 (Asia/Karachi). The workflow built and tested the mounted NestJS API, built the Next.js application, backed up the shared database and application files, ran the prefixed migration, restarted both Passenger applications and passed its API/UI public checks. Independent read-only checks returned health `ok`, three products, the expected OpenAPI title and public server URL, Swagger 200 and operator UI 200.

The first three authorised attempts exposed and fixed, in order, CloudLinux activation under Bash nounset, the parent Laravel front controller capturing nested OrderFlow paths, Passenger requiring an ESM startup graph with top-level await, and Passenger forwarding the mounted API prefix. These failed runs are recorded in `docs/SCENARIOS.md`; they are not reported as successful deployments. The reset cron is still not configured, and no hosted mutation, Postman flow, concurrency scenario, abuse test or O11 fault injection was run.
