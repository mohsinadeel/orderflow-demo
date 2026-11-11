# Scenario matrix

Status: All scenarios **Not run** — 11 November 2026 (Asia/Karachi).

For each executed scenario, add: command/action; starting conditions; expected result; observed result; verification date; commit ID; remaining limits. Keep separate records for Express, NestJS, UI, GraphQL and service split where applicable.

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| O01 | Create valid product and list it | Persisted product with integer price and available stock | Not run |
| O02 | Submit malformed order or non-positive quantity | Validation error; no order or reservation | Not run |
| O03 | Order inactive or missing product | Rejected; stock unchanged | Not run |
| O04 | Create multi-item order | One committed order, captured prices and active reservations | Not run |
| O05 | Request more stock than available | Insufficient-stock response; no partial reservation | Not run |
| O06 | Concurrent requests for four and three units when five are available | Exactly one succeeds; availability never negative | Not run |
| O07 | Retry same order key and payload | Same order returned; no extra reservation | Not run |
| O08 | Reuse order key with different payload | Conflict; original order unchanged | Not run |
| O09 | Change catalogue price after ordering | Existing order keeps captured price and total | Not run |
| O10 | Cancel order, then cancel again | Stock released once; repeated cancellation leaves it unchanged | Not run |
| O11 | Force database failure during order creation | Transaction rolls back; no partial state | Not run |
| U01 | UI handles invalid request and insufficient stock | Operator sees actionable error and unchanged committed state | Not run |
| G01 | Run equivalent query and mutation through REST and GraphQL | Same business outcome; interface cost documented | Not run |
| M01 | Inventory unavailable during order creation | No false success; recovery policy and final state documented | Not run |
| M02 | Duplicate/delayed service message or response | No duplicate reservation; final state documented | Not run |
