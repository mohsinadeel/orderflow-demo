# Inventory service split decision

Decision date: 12 November 2026 (Asia/Karachi).

## Decision

Retain the NestJS modular monolith as the default OrderFlow architecture. Keep the inventory service behind the optional Compose `experiment` profile as inspectable failure-handling evidence; do not route the public Order API through it.

## What the experiment demonstrated

- Inventory items, reservations and the operation ledger can be owned by a separate MySQL instance.
- Stable row locking preserves atomic multi-item reservation within the inventory boundary.
- Caller-generated operation IDs make reservation and release safe to replay.
- A bounded client can retry 5xx responses and refused connections without changing the operation ID.
- When the first response is lost after commit, the retry observes the recorded operation and does not deduct stock twice.
- A failure before commit rolls back every requested line; duplicate release restores stock once.

## Comparison

| Concern | Modular monolith | Split experiment |
| --- | --- | --- |
| Runtime | NestJS API and one MySQL database | Adds an inventory process and a second MySQL instance |
| Order plus reservation consistency | One database transaction | No cross-service atomic transaction |
| Failure handling | Database rollback and bounded deadlock retry | Timeouts, 5xx/refused-connection retry, idempotency ledger and ambiguous-response handling |
| Deployment and recovery | One application/database boundary | Independent health, schema, volume, deployment order and recovery procedure |
| Independent scaling | Not available | Technically possible, but no workload need was demonstrated |
| Latency | No network hop inside order creation | Adds a network hop; no controlled end-to-end latency comparison was run because the public order path was not integrated |

## Why the split is not retained

The experiment moved atomicity rather than preserving it. Inventory can commit while order persistence fails or becomes unreachable. A credible integration would therefore need at least a saga or outbox, compensating release, durable reconciliation and operational visibility for stuck states. None of the executed scenarios demonstrated independent scaling, deployment cadence or ownership pressure that justifies those costs for this demo.

Keeping the modular boundary inside NestJS preserves the important design seam without creating a distributed system prematurely. The isolated service remains useful for explaining idempotency and failure uncertainty, but it is not evidence that the complete OrderFlow workflow is microservice-safe.

## Revisit only if

- inventory must scale or deploy independently;
- multiple order-producing systems need one inventory authority;
- ownership boundaries require a separate datastore; or
- measured contention or availability requirements cannot be met inside the modular monolith.

Any revisit must first specify the order/reservation saga, durable message or outbox semantics, reconciliation ownership, observability and recovery procedures.
