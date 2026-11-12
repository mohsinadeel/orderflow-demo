# Evidence summary

Verified locally and, where explicitly stated, against the hosted demo through 13 November 2026 (Asia/Karachi). This summary links capability claims to executed scenarios; it does not extend them beyond the detailed records in [SCENARIOS.md](SCENARIOS.md).

| Area | Implementation/evidence commits | Executed evidence | Bounded conclusion |
| --- | --- | --- | --- |
| Express REST baseline | `627e5cc`, `b8e1595`, `17b39a9`, `fbd817d` | Six HTTP integration tests; earlier Postman Desktop flow with nine assertions and zero errors | O01–O10 passed within the recorded single-run concurrency and response-visible checks |
| NestJS REST parity | `96a8dfa`, `3fcd505`, `fa3e95e` | Equivalent six-test REST suite against the shared contract | O01–O10 passed for the independent NestJS services; `v0.2.0` marks this boundary |
| Next.js operator workflow | `8328106`, `8f15d0a`, `dfde56f` | Linux production image and Brave flow covering error, reserve, cancel and mobile layout | U01 passed in the recorded browser and viewport |
| GraphQL interface | `3af5490`, `1a8d272` | Three NestJS GraphQL interface/parity tests, included in the current 12-test NestJS suite | G01 passed through resolvers that reuse the NestJS application services |
| Browser REST explorer | `97b415a`, `8db1174`, `32ce8b8` | OpenAPI structure and controls tested; Swagger UI opened from the operator interface in Brave | D01 passed locally; GraphQL remains functional but is not visitor-linked |
| Inventory split experiment | `b5f47cb`, `9698ccd` | Five service/client integration tests passed twice, including rollback, retry, lost response and replay | M01/M02 passed only at the isolated inventory boundary; the modular monolith remains the default |
| Transaction rollback | `61fcea7` | Deterministic failure after transactional writes in the NestJS/MySQL integration suite; current suite 13/13 | O11 passed for an application exception before commit; infrastructure loss and commit ambiguity remain unverified |
| Hosted REST and lifecycle | `ca7cf8e` | Two bounded hosted REST/concurrency runs, two guarded resets, cron installation and final fixture/order reads | Sequential replay/conflict/cancellation and bounded concurrency passed on the shared host; production finished with three fixtures and zero orders |

## Reproduction command

With Docker running and dependencies already installed:

```powershell
.\scripts\verify.ps1 -IncludeBrowser -IncludeExperiment
```

Use `-Install` to run `npm ci` for every included application first. The script builds the default Docker stack, builds and tests both APIs, optionally runs the Brave workflow, then optionally builds and tests the isolated inventory profile. It intentionally excludes registry-dependent audit results and the destructive database reset from the behavioural pass condition.

The full command was executed successfully on 12 November 2026: Express passed 6/6 tests, NestJS passed 12/12, all six Brave checks passed, and the inventory service passed 5/5. On 13 November, the expanded NestJS suite passed 13/13 after adding deterministic rollback coverage and the patched GraphQL dependency. The first sandboxed attempt could not access Docker Desktop and stopped before tests; the successful rerun had Docker access enabled.

## Limits and unverified claims

- O11 is verified only for a deterministic application exception before commit. MySQL process loss, connection interruption, disk failure, commit acknowledgement ambiguity and actual deadlock recovery remain **Not run**.
- Sustained load, simultaneous duplicate service operations, controlled latency and multi-instance coordination remain **Not run**. Hosted evidence is limited to the recorded bounded REST requests.
- The inventory experiment is not wired into `POST /orders`; no distributed order/reservation atomicity claim is made. A saga/outbox and reconciliation policy were not implemented.
- The recorded Postman Desktop result covers Express only. The portable REST collection targets both APIs, but a NestJS Postman runner result remains **Not run**. The GraphQL Postman collection runner also remains **Not run**.
- Authentication, authorisation, abuse testing, multi-instance proxy-aware rate limiting and GraphQL depth/cost controls remain **Not run**. The guarded reset and cron are installed, but the cron's first unattended execution remains unobserved.
- The prior `@graphql-tools/utils` advisory was removed with an exact patched-version override; production audit and the complete suite passed. This is dependency-audit evidence, not a security assessment.
- OrderFlow is deployed, but the bounded hosted checks do not establish production readiness, sustained reliability or capacity.

## Deployment preparation

Post-plan deployment support began at commit `2ae1cb9` and is now deployed. Commits `61fcea7` and `ca7cf8e` add rollback evidence, the dependency patch and guarded production operations. See `SCENARIOS.md` and `DEPLOYMENT.md` for the successful release steps, the deployment runner's cancelled post-step nuance, hosted behavioural results, reset runs and cron installation.
