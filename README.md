# OrderFlow demo

A self-directed, progressive order-management architecture demonstration. This repository will compare Express and NestJS implementations of the same order contract, add a Next.js operator interface and GraphQL API, then test whether separating inventory improves this small system.

**Status:** Express baseline locally verified for the recorded scenarios. Database-failure recovery and later stages remain unverified. See the scenario matrix for evidence and limits.

**Version:** `v0.1.0` marks the locally verified Express baseline and Postman smoke flow. The remaining architecture stages are under development. Version `v1.0.0` is reserved for a documented, stable demo contract after the planned stages and architecture decision are complete.

Read [the specification](docs/SPECIFICATION.md), [scenario matrix](docs/SCENARIOS.md), and [implementation plan](docs/PLAN.md). Results will be recorded with dates and commit IDs as stages are executed.

The self-contained Docker Compose configuration is [compose.yaml](compose.yaml). It uses the official MySQL 8.4 image and builds the Express application image from [its Dockerfile](apps/api-express/Dockerfile).

## Local run

With Docker running, execute from this repository:

```powershell
docker compose up -d --build --wait
```

The Express API listens at `http://localhost:8084` by default. MySQL has an isolated named volume and no host port. Configure local credentials and the API port by copying `.env.example` to `.env`; do not commit `.env`.

Run the integration suite after the stack starts:

```powershell
cd apps/api-express
npm ci
npm test
```

Tests create synthetic products and orders in the persistent local database. To stop containers while keeping data, use `docker compose down`. Do not use `down --volumes` unless you intend to remove the demo's local database.

## Postman

Run the saved nine-request local smoke flow in the **DEMOS → OrderFlow Express — local smoke flow** folder in Postman Desktop. Select **No environment** and use the local runner. A portable copy is in [postman/OrderFlow-Express.postman_collection.json](postman/OrderFlow-Express.postman_collection.json). The sequence creates one synthetic product and order, checks idempotency and stock, then cancels the order twice. It does not test concurrent requests; use the HTTP integration suite for that scenario.

This is a synthetic learning and engineering demonstration, not evidence of prior production delivery with these technologies.
