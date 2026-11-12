# Evidence summary

Verified locally on 12 November 2026 (Asia/Karachi). This summary links capability claims to executed scenarios; it does not extend them beyond the detailed records in [SCENARIOS.md](SCENARIOS.md).

| Area | Implementation/evidence commits | Executed evidence | Bounded conclusion |
| --- | --- | --- | --- |
| Express REST baseline | `627e5cc`, `b8e1595`, `17b39a9`, `fbd817d` | Six HTTP integration tests; earlier Postman Desktop flow with nine assertions and zero errors | O01–O10 passed within the recorded single-run concurrency and response-visible checks |
| NestJS REST parity | `96a8dfa`, `3fcd505`, `fa3e95e` | Equivalent six-test REST suite against the shared contract | O01–O10 passed for the independent NestJS services; `v0.2.0` marks this boundary |
| Next.js operator workflow | `8328106`, `8f15d0a`, `dfde56f` | Linux production image and Brave flow covering error, reserve, cancel and mobile layout | U01 passed in the recorded browser and viewport |
| GraphQL interface | `3af5490`, `1a8d272` | Three NestJS GraphQL interface/parity tests, included in the current 12-test NestJS suite | G01 passed through resolvers that reuse the NestJS application services |
| Browser REST explorer | `97b415a`, `8db1174`, `32ce8b8` | OpenAPI structure and controls tested; Swagger UI opened from the operator interface in Brave | D01 passed locally; GraphQL remains functional but is not visitor-linked |
| Inventory split experiment | `b5f47cb`, `9698ccd` | Five service/client integration tests passed twice, including rollback, retry, lost response and replay | M01/M02 passed only at the isolated inventory boundary; the modular monolith remains the default |

## Reproduction command

With Docker running and dependencies already installed:

```powershell
.\scripts\verify.ps1 -IncludeBrowser -IncludeExperiment
```

Use `-Install` to run `npm ci` for every included application first. The script builds the default Docker stack, builds and tests both APIs, optionally runs the Brave workflow, then optionally builds and tests the isolated inventory profile. It intentionally excludes registry-dependent audit results and the destructive database reset from the behavioural pass condition.

The full command was executed successfully on 12 November 2026: Express passed 6/6 tests, NestJS passed 12/12, all six Brave checks passed, and the inventory service passed 5/5. The first sandboxed attempt could not access Docker Desktop and stopped before tests; the successful rerun had Docker access enabled. The guarded reset's refusal path was checked, but its destructive success path was not run.

## Limits and unverified claims

- O11 database-failure rollback and actual deadlock recovery in the public order path remain **Not run**. The bounded retry implementation alone is not execution evidence.
- Sustained load, simultaneous duplicate service operations, controlled latency, multi-instance coordination and hosted behaviour remain **Not run**.
- The inventory experiment is not wired into `POST /orders`; no distributed order/reservation atomicity claim is made. A saga/outbox and reconciliation policy were not implemented.
- The recorded Postman Desktop result covers Express only. The portable REST collection targets both APIs, but a NestJS Postman runner result remains **Not run**. The GraphQL Postman collection runner also remains **Not run**.
- Authentication, authorisation, public data lifecycle, abuse testing, proxy-aware rate limiting and GraphQL depth/cost controls remain **Not run**.
- The NestJS dependency tree retains the recorded high-severity transitive `@graphql-tools/utils` advisory. This is a known limitation, not a passed security assessment.
- No OrderFlow deployment has been performed. Local Docker and browser results do not establish hosted reliability or production readiness.
