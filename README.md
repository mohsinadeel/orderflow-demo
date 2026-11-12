# OrderFlow demo

A self-directed, progressive order-management architecture demonstration. This repository will compare Express and NestJS implementations of the same order contract, add a Next.js operator interface and GraphQL API, then test whether separating inventory improves this small system.

**Status:** Express and NestJS REST implementations, the Next.js operator workflow, the NestJS GraphQL interface and an isolated inventory-service experiment are locally verified for the recorded scenarios. The split is not retained as the default architecture; database-failure recovery in the public order path remains unverified.

**Version:** `v0.1.0` marks the locally verified Express baseline and Postman smoke flow. `v0.2.0` marks locally verified NestJS parity for the recorded REST scenarios. Version `v1.0.0` is reserved for a documented, stable demo contract after the planned stages and architecture decision are complete.

Read [the specification](docs/SPECIFICATION.md), [scenario matrix](docs/SCENARIOS.md), [evidence summary](docs/EVIDENCE-SUMMARY.md), and [implementation plan](docs/PLAN.md). Results are bounded by the recorded commands, dates, commit IDs and limitations.

The prepared hosted topology and its unverified prerequisites are documented in [the deployment guide](docs/DEPLOYMENT.md). Deployment remains manual-only and separate from local verification.

The self-contained Docker Compose configuration is [compose.yaml](compose.yaml). It uses the official MySQL 8.4 image and builds independent Express and NestJS application images. Both applications use the same schema and external contract, but keep their business services separate.

## Local run

With Docker running, execute from this repository:

```powershell
docker compose up -d --build --wait
```

The Express API listens at `http://localhost:8084`, NestJS at `http://localhost:8085`, Swagger UI at `http://localhost:8085/api/docs`, the raw OpenAPI document at `http://localhost:8085/api/openapi.json`, GraphQL and GraphiQL at `http://localhost:8085/graphql`, and the Next.js operator interface at `http://localhost:8086`. The operator header links to the REST explorer; GraphQL remains available for direct technical inspection without a visitor-facing button. MySQL has an isolated named volume and no host port. Configure local credentials and ports by copying `.env.example` to `.env`; do not commit `.env`.

`ORDERFLOW_PUBLIC_API_URL` controls the browser-visible API origin used by those explorer links. It defaults to `http://localhost:8085`; a hosted deployment must set its public API URL explicitly. The NestJS interface applies a 32 KB JSON-body limit, a general in-memory limit of 600 requests per minute per client, and a tighter 120-per-minute limit to mutations. These limits support the repeatable behavioural suite while bounding casual anonymous use; they are not a complete public security model. A proxy deployment must configure trusted proxy handling before IP-based limiting can be relied upon.

Run the integration suite after the stack starts:

```powershell
cd apps/api-express
npm ci
npm test

cd ../api-nest
npm ci
npm run build
npm test
```

The Express suite runs six black-box REST scenarios. The NestJS suite runs those same six scenarios plus three GraphQL interface/parity scenarios, creating synthetic products and orders in the persistent local database. Local Docker images use the Node 22 LTS line to match the cPanel/GitHub deployment target; NestJS 12 requires Node 20.19+ or a supported newer line. To stop containers while keeping data, use `docker compose down`. Do not use `down --volumes` unless you intend to remove the demo's local database.

Run the UI browser scenario with the installed Brave browser after the stack is healthy:

```powershell
npm --prefix .\apps\web-next run test:ui
```

## Reproduce verification

From the repository root, run the default API verification:

```powershell
.\scripts\verify.ps1
```

Add `-Install` for clean dependency installation, `-IncludeBrowser` for the Brave operator flow, and `-IncludeExperiment` for the isolated inventory-service checks. The full local workflow used for the final evidence run is:

```powershell
.\scripts\verify.ps1 -IncludeBrowser -IncludeExperiment
```

The suites create synthetic products and orders in the persistent local database. To replace accumulated local data with the three catalogue fixtures defined in `apps/api-express/schema.sql`, run the guarded destructive reset explicitly:

```powershell
.\scripts\reset-demo.ps1 -Confirmation 'RESET-ORDERFLOW-LOCAL-DATA'
```

This removes both Compose-owned MySQL volumes, including all local orders, products and inventory-experiment data, then rebuilds only the default stack. It does not affect external databases. The reset workflow is provided for reproducibility but is not part of the passing scenario evidence unless its execution is recorded separately.

## Inventory-service experiment

The optional `experiment` Compose profile starts a separate inventory service on `http://localhost:8087` and a second MySQL instance with its own persistent volume:

```powershell
docker compose --profile experiment up -d --build --wait inventory-service
npm --prefix .\apps\inventory-service run build
npm --prefix .\apps\inventory-service test
```

The five integration scenarios exercise pre-commit rollback, bounded retries for 503 and refused connections, a lost response after commit, idempotency conflicts and duplicate release. This service is deliberately not wired into the public Order API: doing so would replace one ACID transaction with a distributed consistency problem requiring a saga/outbox and reconciliation. See [the architecture decision](docs/INVENTORY-SPLIT-DECISION.md).

## Postman

Import or update [postman/OrderFlow-REST.postman_collection.json](postman/OrderFlow-REST.postman_collection.json) in Postman Desktop, select **No environment**, and use the local runner. Set the collection variable `baseUrl` to `http://localhost:8084` for Express, run the full collection, then set it to `http://localhost:8085` for NestJS and run it again. The named `expressBaseUrl` and `nestBaseUrl` variables retain both targets. The nine-request sequence creates one synthetic product and order, checks idempotency and stock, then cancels the order twice. It does not test concurrent requests; use the HTTP integration suites for that scenario.

Import [postman/OrderFlow-GraphQL.postman_collection.json](postman/OrderFlow-GraphQL.postman_collection.json) for the NestJS GraphQL smoke flow. Its eight requests create a product and order, verify replay and conflict behaviour, query state, cancel the order and confirm stock restoration. The repository integration test is the recorded REST/GraphQL comparison; a Postman runner result is recorded only after that collection is actually run.

This is a synthetic learning and engineering demonstration, not evidence of prior production delivery with these technologies.
