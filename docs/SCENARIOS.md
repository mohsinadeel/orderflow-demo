# Scenario matrix

Status: Express local integration run recorded below — 12 November 2026 (Asia/Karachi). NestJS, UI, GraphQL and service-split scenarios remain **Not run**.

For each executed scenario, add: command/action; starting conditions; expected result; observed result; verification date; commit ID; remaining limits. Keep separate records for Express, NestJS, UI, GraphQL and service split where applicable.

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| O01 | Create valid product and list it | Persisted product with integer price and available stock | Locally verified, Express |
| O02 | Submit malformed order or non-positive quantity | Validation error; no order or reservation | Locally verified for zero quantity, Express |
| O03 | Order inactive or missing product | Rejected; stock unchanged | Locally verified for inactive product, Express |
| O04 | Create multi-item order | One committed order, captured prices and active reservations | Locally verified through response and availability, Express |
| O05 | Request more stock than available | Insufficient-stock response; no partial reservation | Locally verified through response and availability, Express |
| O06 | Concurrent requests for four and three units when five are available | Exactly one succeeds; availability never negative | Locally verified in one run, Express |
| O07 | Retry same order key and payload | Same order returned; no extra reservation | Locally verified for sequential and concurrent replay, Express |
| O08 | Reuse order key with different payload | Conflict; original order unchanged | Locally verified, Express |
| O09 | Change catalogue price after ordering | Existing order keeps captured price and total | Locally verified, Express |
| O10 | Cancel order, then cancel again | Stock released once; repeated cancellation leaves it unchanged | Locally verified, Express |
| O11 | Force database failure during order creation | Transaction rolls back; no partial state | Not run |
| U01 | UI handles invalid request and insufficient stock | Operator sees actionable error and unchanged committed state | Not run |
| G01 | Run equivalent query and mutation through REST and GraphQL | Same business outcome; interface cost documented | Not run |
| M01 | Inventory unavailable during order creation | No false success; recovery policy and final state documented | Not run |
| M02 | Duplicate/delayed service message or response | No duplicate reservation; final state documented | Not run |

## Express local run — 12 November 2026

- **Command:** `docker compose -f C:\repos\demos\orderflow-demo\compose.yaml up -d --build --wait`, followed by `npm run build` and `npm test` in `apps/api-express`.
- **Starting conditions:** isolated Compose project with persistent MySQL volume; tests generated new synthetic product IDs and idempotency keys. No production database or hosted service was used.
- **Expected:** O01–O10 behaviours above; both same-key concurrent requests produce one order and one reservation. Test code: `apps/api-express/test/orderflow.test.ts`.
- **Observed:** image built; MySQL and API reached healthy state; TypeScript build passed; six HTTP integration tests passed against the running API. In the competing-orders test, statuses were 201 and 409; in the same-key test, statuses were 201 and 200 with one order ID and two units deducted once.
- **Implementation commit:** `627e5cc`. **Specification commit:** `9a2f526`.
- **Limits:** scenarios have not been repeated under sustained load; reservation table rows were not queried independently; O11 database-failure rollback and actual deadlock recovery were not executed. A bounded three-attempt retry policy for deadlocks and lock wait timeouts is implemented, but its fault path is unverified. NestJS parity and all later stages are Not run. The first same-key concurrency attempt exposed a 500 caused by a locking read; removing that unnecessary lock and rebuilding produced the passing run. This is local integration evidence only.
