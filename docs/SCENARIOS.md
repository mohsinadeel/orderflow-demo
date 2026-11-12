# Scenario matrix

Status: Express, NestJS, UI, GraphQL and the isolated inventory-service experiment are locally verified within the boundaries below — 12 November 2026 (Asia/Karachi). Database-failure injection in the public order path remains **Not run**.

For each executed scenario, add: command/action; starting conditions; expected result; observed result; verification date; commit ID; remaining limits. Keep separate records for Express, NestJS, UI, GraphQL and service split where applicable.

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| O01 | Create valid product and list it | Persisted product with integer price and available stock | Locally verified, Express and NestJS |
| O02 | Submit malformed order or non-positive quantity | Validation error; no order or reservation | Locally verified for zero quantity, Express and NestJS |
| O03 | Order inactive or missing product | Rejected; stock unchanged | Locally verified for inactive product, Express and NestJS |
| O04 | Create multi-item order | One committed order, captured prices and active reservations | Locally verified through response and availability, Express and NestJS |
| O05 | Request more stock than available | Insufficient-stock response; no partial reservation | Locally verified through response and availability, Express and NestJS |
| O06 | Concurrent requests for four and three units when five are available | Exactly one succeeds; availability never negative | Locally verified in one run per API |
| O07 | Retry same order key and payload | Same order returned; no extra reservation | Locally verified for sequential and concurrent replay, Express and NestJS |
| O08 | Reuse order key with different payload | Conflict; original order unchanged | Locally verified, Express and NestJS |
| O09 | Change catalogue price after ordering | Existing order keeps captured price and total | Locally verified, Express and NestJS |
| O10 | Cancel order, then cancel again | Stock released once; repeated cancellation leaves it unchanged | Locally verified, Express and NestJS |
| O11 | Force database failure during order creation | Transaction rolls back; no partial state | Not run |
| U01 | UI handles invalid request and insufficient stock | Operator sees actionable error and unchanged committed state | Locally verified in Brave |
| G01 | Run equivalent query and mutation through REST and GraphQL | Same business outcome; interface cost documented | Locally verified against NestJS |
| D01 | Open the REST explorer from the operator interface | Browser-accessible REST contract renders; OpenAPI describes executable inputs and responses | Locally verified in Brave |
| M01 | Inventory unavailable during order creation | No false success; recovery policy and final state documented | Locally verified in isolated inventory client/service experiment |
| M02 | Duplicate/delayed service message or response | No duplicate reservation; final state documented | Locally verified in isolated inventory client/service experiment |

## Express local run — 12 November 2026

- **Command:** `docker compose -f C:\repos\demos\orderflow-demo\compose.yaml up -d --build --wait`, followed by `npm run build` and `npm test` in `apps/api-express`.
- **Starting conditions:** isolated Compose project with persistent MySQL volume; tests generated new synthetic product IDs and idempotency keys. No production database or hosted service was used.
- **Expected:** O01–O10 behaviours above; both same-key concurrent requests produce one order and one reservation. Test code: `apps/api-express/test/orderflow.test.ts`.
- **Observed:** image built; MySQL and API reached healthy state; TypeScript build passed; six HTTP integration tests passed against the running API. In the competing-orders test, statuses were 201 and 409; in the same-key test, statuses were 201 and 200 with one order ID and two units deducted once.
- **Implementation commit:** `627e5cc`. **Specification commit:** `9a2f526`.
- **Limits:** scenarios have not been repeated under sustained load; reservation table rows were not queried independently; O11 database-failure rollback and actual deadlock recovery were not executed. A bounded three-attempt retry policy for deadlocks and lock wait timeouts is implemented, but its fault path is unverified. The first same-key concurrency attempt exposed a 500 caused by a locking read; removing that unnecessary lock and rebuilding produced the passing run. This is local integration evidence only.

## NestJS parity run — 12 November 2026

- **Commands:** `npm --prefix C:\repos\demos\orderflow-demo\apps\api-nest run build`; `docker compose -f C:\repos\demos\orderflow-demo\compose.yaml up -d --build --wait`; then `npm --prefix C:\repos\demos\orderflow-demo\apps\api-express test` and `npm --prefix C:\repos\demos\orderflow-demo\apps\api-nest test`.
- **Starting conditions:** Node 24.15.0, NestJS 12.4.x and MySQL 8.4 in the isolated Compose project. Express used port 8084 and NestJS port 8085. Both APIs used the existing persistent schema; each suite generated new synthetic IDs and idempotency keys.
- **Expected:** both independent implementations pass the same O01–O10 black-box behaviours, including competing orders and concurrent replay of one idempotency key.
- **Observed:** both images built; MySQL and NestJS health checks passed, and Express was reachable. Express passed six of six tests. The first NestJS run passed five of six and exposed a contract mismatch: repeated cancellation returned Nest's default POST status 201 rather than the specified 200. After adding the explicit cancellation status and rebuilding, NestJS passed six of six tests. The final run had no failed tests.
- **Implementation commit:** `96a8dfa`.
- **Limits:** O11 was not run. Neither actual deadlock recovery nor sustained concurrency was tested. The suites verify response-visible reservations through stock changes, not reservation rows independently. Both APIs currently share one database/schema; this is modular-monolith parity, not service isolation. No Postman run was executed against NestJS, and no hosted deployment was attempted.

## Postman local smoke flow — 12 November 2026

- **Action:** Run **DEMOS → OrderFlow Express — local smoke flow** in Postman Desktop, local runner, one iteration, no environment. Portable source: `postman/OrderFlow-Express.postman_collection.json`.
- **Starting conditions:** Express and MySQL Compose containers running; isolated persistent local MySQL database. The flow generated a synthetic product and a fresh idempotency key. Implementation commit `b8e1595` was running; the Postman collection was not yet committed.
- **Expected:** health 200; product creation 201; order creation 201; identical replay 200 with the same order ID; changed request under the same key 409; stock 5 → 3 → 5 after cancellation and repeated cancellation.
- **Observed:** nine requests, nine assertions passed, zero errors. The run displayed 201 for product/order creation, 200 for replay, 409 for changed-key conflict, and 200 for cancellation and stock reads. Duration 1.717 seconds; average response time 31 ms. The run result was visible in Postman at 03:04:57 Asia/Karachi.
- **Portable collection update:** the source is now `postman/OrderFlow-REST.postman_collection.json`, with explicit Express (`http://localhost:8084`) and NestJS (`http://localhost:8085`) target variables. Equivalent sequential HTTP requests returned the expected 200/201/409 transitions against both APIs after the update. This was not a Postman Desktop runner execution, so no new Postman assertion count is claimed.
- **Limits:** the recorded Postman Desktop result remains the earlier Express run. The sequential flow does not verify concurrent stock reservation, sustained load, rollback under injected failure, or a hosted integration. The performance numbers are diagnostic for that run only, not a benchmark. A NestJS Postman Desktop runner result remains Not run.

## Next.js operator workflow — 12 November 2026

- **Commands/actions:** built `apps/web-next` in Docker through `docker compose up -d --build --wait web-next`; opened `http://localhost:8086`; exercised the Next.js `/api/orderflow` proxy with synthetic product and order requests.
- **Starting conditions:** Next.js 16.4.6 on Node 24, NestJS on port 8085, UI on port 8086 and the existing isolated MySQL volume. The interface used the NestJS API through a same-origin server proxy.
- **Expected:** responsive product/order inspection, successful reservation and cancellation controls, and an actionable insufficient-stock message without changing stock.
- **Observed:** the production Docker image compiled, TypeScript passed and the UI health check passed. Desktop rendering was visually inspected. The repeatable headless-Brave flow passed insufficient-stock feedback with unchanged stock, successful reservation with deduction, cancellation with restoration, and the 390px stacked layout. The test exposed two error-message clearing races in the refresh flow; both were corrected before the passing run.
- **Implementation commits:** `8328106`, `8f15d0a`.
- **Limits:** the test used installed Brave in headless mode and a 390×844 viewport; 200% zoom, screen-reader output and dark mode were not independently inspected. The native Windows build compiled and type-checked but standalone file copying hit a sandbox `EPERM`; the Linux Docker production build passed. This remains local synthetic-data evidence, not hosted or production evidence.

## NestJS GraphQL interface — 12 November 2026

- **Commands/actions:** installed the official NestJS GraphQL/Apollo packages; ran `npm --prefix apps/api-nest run build`; rebuilt the NestJS Docker image with `docker compose up -d --build --wait api-nest`; ran `npm --prefix apps/api-nest test` and `npm --prefix apps/api-express test`; parsed the portable Postman collection as JSON; requested GraphiQL with a browser-style `Accept: text/html` header.
- **Starting conditions:** NestJS and MySQL were running in the existing isolated Compose project on port 8085. Tests created fresh synthetic products, orders and idempotency keys in the persistent local database. GraphQL resolvers called the existing NestJS product and order services.
- **Expected:** equivalent REST and GraphQL product/order workflows produce the same reservation totals, stock changes, detail state and cancellation outcome; replay returns the same order; conflicts and insufficient stock remain machine-readable.
- **Observed:** final NestJS run passed nine of nine tests: the existing six REST scenarios plus three GraphQL interface/parity scenarios. Express still passed six of six. The parity test compared independent REST and GraphQL products/orders through creation, reservation, detail query, cancellation and restored stock. GraphQL replay returned the same order; conflict and insufficient-stock responses exposed `extensions.code` and `extensions.status`. A separate test preserved a 3,000,000,000 minor-unit price and total using validated integer values over GraphQL `Float`. GraphiQL returned HTTP 200 and its page content when requested with a browser-style header.
- **Corrections during verification:** the first GraphQL run passed one of two tests. Apollo removed the reserved `extensions.http` object from an error response, so the public metadata was changed to `extensions.status`; the rebuilt service then passed. A subsequent review identified GraphQL's 32-bit `Int` limit for prices/totals before final evidence was recorded; those fields now use `Float` with integer validation, and the large-value test passed.
- **Implementation commit:** `3af5490`.
- **Postman:** repository source `postman/OrderFlow-GraphQL.postman_collection.json` contains eight ordered requests and parsed as valid JSON. A separate cloud collection named **OrderFlow GraphQL — local smoke flow** was created in the connected personal workspace. The connected tool did not expose collection execution, and no Postman Desktop runner was run, so its saved assertions remain **Not run**.
- **Limits:** HTTP 200 is normal for GraphQL domain errors; clients must inspect `errors` and extension metadata. Authentication, authorisation, query-depth/cost limits, persisted operations, subscriptions, performance comparison and hosted behaviour were not tested. `npm audit --omit=dev` reports one high-severity transitive `@graphql-tools/utils` advisory; the normal non-breaking `npm audit fix` did not resolve it. The blocked `@apollo/protobufjs` postinstall was not approved because runtime/build verification passed without it. This is local synthetic-data evidence only.

## Browser API explorers — 12 November 2026

- **Commands/actions:** built NestJS and Next.js; rebuilt `api-nest` and `web-next` through `docker compose up -d --build --wait`; ran `npm --prefix apps/api-nest test`, `npm --prefix apps/api-express test` and `npm --prefix apps/web-next run test:ui`; ran `npm --prefix apps/api-nest audit --omit=dev`.
- **Starting conditions:** local Compose stack with MySQL, NestJS on 8085 and Next.js on 8086. `ORDERFLOW_PUBLIC_API_URL` resolved to `http://localhost:8085`. Brave ran headlessly against the real pages and synthetic records.
- **Expected:** the operator link opens the interactive REST contract; OpenAPI includes product/order inputs, the idempotency header, response models and errors; existing API and UI behaviour remains unchanged; oversized JSON is rejected and rate-limit headers are present. GraphQL remains directly available without a visitor-facing link.
- **Observed:** the Linux production images built and both services became healthy. NestJS passed 12 of 12 tests, including Swagger HTML, OpenAPI structure/examples, rate-limit headers and a 40 KB JSON request rejected with 413/`PAYLOAD_TOO_LARGE`. Express remained six of six. The final Brave flow passed insufficient stock, reservation, cancellation, mobile layout, Swagger UI rendering and verification that no GraphQL visitor link is present. The REST link opened `http://localhost:8085/api/docs`; GraphQL functionality remained at `http://localhost:8085/graphql`.
- **Correction during verification:** an initial 20-mutation-per-minute configuration caused three existing NestJS scenarios to return 429 after repeated verification runs from one IP. It was raised to 120 mutations per minute with a 600-request general limit; after rebuilding to clear process-local counters, the full final run passed. This is calibration for the demo suite, not a production capacity claim.
- **Implementation commit:** `97b415a`.
- **Limits:** the native Windows Next build compiled and type-checked but again failed while copying standalone traced files with sandbox `EPERM`; the Linux Docker production build passed. Rate limits use process-local memory and were not tested through a reverse proxy or multiple instances. Limit exhaustion was observed under the rejected 20-request configuration, but the final 120/600 thresholds were not exhausted. Anonymous data reset, authentication, authorisation, hosted CORS/proxy configuration and public abuse testing remain Not run. The existing high-severity transitive `@graphql-tools/utils` audit advisory remains. No Postman change was required because the REST/GraphQL operations did not change.

## Isolated inventory-service experiment — 12 November 2026

- **Commands/actions:** installed and built `apps/inventory-service`; ran `docker compose up -d --build --wait inventory-service`; ran `npm --prefix apps/inventory-service test` once with four scenarios, then twice after adding the refused-connection scenario; ran `npm --prefix apps/inventory-service audit --omit=dev`; reran the NestJS and Express suites and inspected `docker compose ps`.
- **Starting conditions:** optional inventory service on port 8087 and a separate MySQL 8.4 instance/volume. Tests generated fresh product, order and operation UUIDs. The verified public NestJS/Express paths continued using the original database and were not routed through the experiment.
- **Expected:** injected pre-commit failure rolls back all stock changes; 503 and network failures exhaust a bounded three-attempt budget without false success; a retry after a lost post-commit response replays one reservation; changed content conflicts; duplicate release restores stock once.
- **Observed:** the initial four-test run passed. After adding an actual refused connection on `127.0.0.1:65534`, two consecutive five-test runs passed (394 ms and 365 ms test execution respectively). The delayed first response committed, timed out at the client, and the retry returned `replayed: true`; stock moved from five to three once and one reservation line remained. Pre-commit injected failure left both products unchanged. Repeated release returned `replayed: true` and restored stock once. Package audit reported zero vulnerabilities. NestJS remained 12/12 and Express 6/6; both original and experimental databases/services reported healthy.
- **Implementation commit:** `b5f47cb`.
- **Decision:** do not retain the split as the default. It adds one service, one database, a network boundary, an operation ledger and retry semantics while leaving order-plus-reservation atomicity unresolved. The optional experiment remains for inspection; see `docs/INVENTORY-SPLIT-DECISION.md`.
- **Limits:** M01/M02 were verified at the isolated inventory client/service boundary, not through `POST /orders`; no false order success claim is made. Duplicate delivery was sequential/retry-driven; simultaneous duplicate operations were not run. A full saga/outbox, compensating release after order persistence failure, durable reconciliation, multi-instance retry coordination, proxy behaviour, controlled latency benchmark, load test and hosted deployment were not implemented or run. O11 remains Not run for the public order path.
