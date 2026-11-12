# Progressive implementation plan

Status: Milestones 0–4 locally verified — 12 November 2026 (Asia/Karachi).

## Architecture and runtime

- One independently runnable repository, `orderflow-demo`, with `apps/api-express`, `apps/api-nest`, and `apps/web-next`. Its `compose.yaml` and application Dockerfiles live in this repository, not the parent portal.
- TypeScript throughout. Official Node image as the base for application Dockerfiles and official MySQL 8.4 image in Docker Compose. Use an isolated Compose project, persistent named database volume, and ports that do not collide with the existing portal/demos.
- MySQL is the default database. Select the smallest maintained data-access approach after inspecting current compatibility; no ORM is required merely for presentation.
- Express and NestJS own independent implementations of the same contract. Shared scenario definitions may be reused; business-service implementations should remain separate for a meaningful comparison.
- NestJS orders and inventory begin as modules in one process/database. GraphQL resolvers reuse the same NestJS application services. The Next.js UI initially uses REST.
- The inventory-service stage is a branch or isolated experiment with independent data ownership. Its results determine whether the split is retained.

## Milestones and local commit boundaries

0. Fix JSON contract, database schema, failure mapping and scenario matrix. Commit specification and repository setup.
1. Implement Express API, image and Compose runtime. Verify transaction, concurrency, idempotency and cancellation scenarios. Commit the verified baseline.
2. Reimplement the contract in NestJS modules and injectable services. Run the same black-box scenarios against both APIs. **Locally verified at implementation commit `96a8dfa`.**
3. Build a restrained Next.js operator interface. Verify browser flows and error states. **Locally verified; implementation commit `8328106`, browser test and race fixes `8f15d0a`.**
4. Add GraphQL queries and mutations over NestJS services. Compare equivalent REST and GraphQL workflows. **Locally verified; interface and evidence commits recorded in the scenario matrix.**
4.5. Expose the REST and GraphQL contracts to browser visitors. Serve Swagger UI and OpenAPI from NestJS, link both explorers from the operator interface, add examples and bounded request controls, then verify the pages in a real browser. **Locally verified; evidence recorded in the scenario matrix.**
5. Extract inventory as an experiment. Verify network failure, retry, duplicate request and partial failure handling. Commit the experiment and architecture decision.
6. Prepare reproducible instructions and an evidence summary. Keep capability claims tied to executed scenarios. Content/article planning follows the implementation evidence.

Commits remain local until Mohsin explicitly authorises a push. GitHub repository creation is separate from a code push. No hosted deployment is assumed.

## Decision gate for the service split

Compare the modular monolith and split version using the same functional scenarios. Record added processes/databases, deployment steps, latency, failure handling, recovery work and any demonstrated benefit from independent operation. Retain the split only if an actual need outweighs these costs.
