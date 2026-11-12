# OrderFlow demo

A self-directed, progressive order-management architecture demonstration. This repository will compare Express and NestJS implementations of the same order contract, add a Next.js operator interface and GraphQL API, then test whether separating inventory improves this small system.

**Status:** Express and NestJS REST implementations, the Next.js operator workflow and the NestJS GraphQL interface are locally verified for the recorded scenarios. Database-failure recovery and the service-split stage remain unverified.

**Version:** `v0.1.0` marks the locally verified Express baseline and Postman smoke flow. `v0.2.0` marks locally verified NestJS parity for the recorded REST scenarios. Version `v1.0.0` is reserved for a documented, stable demo contract after the planned stages and architecture decision are complete.

Read [the specification](docs/SPECIFICATION.md), [scenario matrix](docs/SCENARIOS.md), and [implementation plan](docs/PLAN.md). Results will be recorded with dates and commit IDs as stages are executed.

The self-contained Docker Compose configuration is [compose.yaml](compose.yaml). It uses the official MySQL 8.4 image and builds independent Express and NestJS application images. Both applications use the same schema and external contract, but keep their business services separate.

## Local run

With Docker running, execute from this repository:

```powershell
docker compose up -d --build --wait
```

The Express API listens at `http://localhost:8084`, NestJS at `http://localhost:8085`, Swagger UI at `http://localhost:8085/api/docs`, the raw OpenAPI document at `http://localhost:8085/api/openapi.json`, GraphQL and GraphiQL at `http://localhost:8085/graphql`, and the Next.js operator interface at `http://localhost:8086`. The operator header links to both interactive API explorers. MySQL has an isolated named volume and no host port. Configure local credentials and ports by copying `.env.example` to `.env`; do not commit `.env`.

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

The Express suite runs six black-box REST scenarios. The NestJS suite runs those same six scenarios plus three GraphQL interface/parity scenarios, creating synthetic products and orders in the persistent local database. NestJS 12.4 is used with Node 24.15; NestJS 12 requires Node 20.19+ or a supported newer line. To stop containers while keeping data, use `docker compose down`. Do not use `down --volumes` unless you intend to remove the demo's local database.

Run the UI browser scenario with the installed Brave browser after the stack is healthy:

```powershell
npm --prefix .\apps\web-next run test:ui
```

## Postman

Import or update [postman/OrderFlow-REST.postman_collection.json](postman/OrderFlow-REST.postman_collection.json) in Postman Desktop, select **No environment**, and use the local runner. Set the collection variable `baseUrl` to `http://localhost:8084` for Express, run the full collection, then set it to `http://localhost:8085` for NestJS and run it again. The named `expressBaseUrl` and `nestBaseUrl` variables retain both targets. The nine-request sequence creates one synthetic product and order, checks idempotency and stock, then cancels the order twice. It does not test concurrent requests; use the HTTP integration suites for that scenario.

Import [postman/OrderFlow-GraphQL.postman_collection.json](postman/OrderFlow-GraphQL.postman_collection.json) for the NestJS GraphQL smoke flow. Its eight requests create a product and order, verify replay and conflict behaviour, query state, cancel the order and confirm stock restoration. The repository integration test is the recorded REST/GraphQL comparison; a Postman runner result is recorded only after that collection is actually run.

This is a synthetic learning and engineering demonstration, not evidence of prior production delivery with these technologies.
