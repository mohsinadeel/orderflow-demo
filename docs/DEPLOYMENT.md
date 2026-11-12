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
| NestJS API | `demo.mohsinadeel.dev/orderflow-api` | `demo.mohsinadeel.dev/orderflow-api` | `server.mjs` |
| Next.js UI | `demo.mohsinadeel.dev/orderflow-demo` | `demo.mohsinadeel.dev/orderflow-demo` | `passenger.cjs` |

Use Node `22.23.5`, production mode, and separate Passenger logs under `/home6/inceptio/logs/`. Do not create either application until the release artefacts and server environment files are ready.

The API root requires an owner-readable `.env` containing the established shared database connection plus:

```dotenv
NODE_ENV=production
DB_TABLE_PREFIX=orderflow_
ORDERFLOW_PUBLIC_API_URL=https://demo.mohsinadeel.dev/orderflow-api
TRUST_PROXY_HOPS=1
```

The UI root requires:

```dotenv
NODE_ENV=production
ORDERFLOW_API_URL=https://demo.mohsinadeel.dev/orderflow-api
ORDERFLOW_PUBLIC_API_URL=https://demo.mohsinadeel.dev/orderflow-api
```

The files must remain outside Git and use owner-only permissions. The API migration command validates `DB_TABLE_PREFIX` before constructing identifiers. It creates only the four `orderflow_` tables and inserts the three synthetic catalogue fixtures when absent; it does not create or alter shared users.

Because the API is intentionally anonymous, configure a cPanel cron after deployment to reset only the `orderflow_` data on an agreed schedule. The command requires both a non-empty prefix and the exact confirmation `ORDERFLOW_RESET_CONFIRMATION=RESET-ORDERFLOW-DATA`; it deletes reservations, items, orders and products in foreign-key order, then restores the three fixtures. Do not schedule it until the first hosted smoke test has passed and its timing has been agreed.

## GitHub configuration

The manual-only workflow `.github/workflows/deploy.yml` uses the same VPN and SSH model as the existing demos. Configure the OrderFlow repository's `production` environment with:

- Secrets: `OPENVPN_CONFIG`, `VPN_USERNAME`, `VPN_PASSWORD`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SSH_PORT`, `SSH_USERNAME`
- Variable: `SSH_HOST`

The workflow builds and tests NestJS against a prefixed CI schema, builds the Next.js standalone application for `/orderflow-demo`, uploads both artefacts, preserves the server `.env` files, runs the production migration, restarts Passenger through `tmp/restart.txt`, and checks the two public endpoints.

The workflow has not been run. cPanel application creation, server environment files, shared-database backup, migration, reset cron, Passenger routing and public HTTP behaviour remain unverified until an explicitly authorised deployment.
