# OrderFlow specification

Status: Planned — 11 November 2026 (Asia/Karachi).

## Problem

An operator needs to create orders for catalogue products without overselling stock. Retries and cancellation must not create or release stock twice. The same observable rules will be implemented in Express and NestJS before other interfaces are added.

## Expected behaviour

- Products have a stable ID, name, active flag, price in integer minor currency units, currency, and stock quantity. The initial demo uses one currency (USD) and synthetic catalogue data.
- An order contains one or more distinct product lines with positive integer quantities. Each line captures product ID, name, unit price and currency at order creation. Later catalogue changes do not alter historical order totals.
- A caller supplies an idempotency key for order creation. The key is unique to one request payload. Repeating the same key and payload returns the same order; reusing the key with different content is a conflict.
- Creating an order checks that every product exists and is active, and reserves all requested quantities atomically. Either the complete order and all its reservations exist, or none do. Stock available for new orders never becomes negative.
- A new order is `reserved`. Cancellation changes it to `cancelled` and releases all of its active reservations exactly once. Cancelling an already cancelled order returns its current state without another release.
- Concurrent requests that together exceed available stock cannot both succeed. Acquire product locks in stable ID order or use equivalent conditional updates within one transaction; handle database deadlocks by retrying the entire transaction within a bounded policy.
- An order list/detail endpoint and product list endpoint allow inspection of committed state. The API gives distinct validation, not-found, insufficient-stock, idempotency-conflict and unexpected-failure responses.

## Initial data model

`products`: id, name, active, unit_price_minor, currency, stock_available, timestamps.

`orders`: id, idempotency_key (unique), request_fingerprint, status, total_minor, currency, timestamps.

`order_items`: order_id, product_id, product_name_snapshot, unit_price_minor, quantity, line_total_minor.

`reservations`: id, order_id, product_id, quantity, status (`active` or `released`), timestamps. A uniqueness constraint prevents duplicate reservation rows for one order/product pair.

The first implementation may adjust column names and indexes while preserving these invariants. Database ownership changes only in the service-split experiment.

## Initial REST contract

- `POST /products`: create a product with name, unit price and initial stock.
- `GET /products`: list products with current availability.
- `PATCH /products/:id`: change unit price or active state; stock quantity is not changed through this endpoint.
- `POST /orders`: create an order from product IDs and quantities, with an idempotency key.
- `GET /orders` and `GET /orders/:id`: inspect orders and captured line prices.
- `POST /orders/:id/cancel`: cancel an order idempotently.

Request JSON: `POST /products` accepts `{ name, unitPriceMinor, stockAvailable }`; `POST /orders` accepts `{ items: [{ productId, quantity }] }` and an `Idempotency-Key` header. The server assigns IDs. USD is implicit in this first slice. A repeated key with an equivalent canonical set of lines returns the same order.

Response JSON uses camelCase. Successful product creation returns 201; order creation returns 201; a matching idempotent replay returns 200; cancellation returns 200. Validation returns 400, missing records 404, insufficient stock and key reuse with a different payload 409, and unexpected errors 500. Error responses use `{ error: { code, message } }`. These shapes and status codes are the parity contract for NestJS.

## GraphQL interface

The NestJS application also exposes `/graphql` as an alternative interface over the same `ProductsService` and `OrdersService`; it does not contain a separate domain implementation. The code-first schema provides:

- queries `products`, `orders` and `order(id)`;
- mutations `createProduct(input)`, `updateProduct(id, input)`, `createOrder(input)` and `cancelOrder(id)`;
- product and order fields matching the REST response names and integer minor-unit values.

`CreateOrderInput` carries `idempotencyKey` as a field because GraphQL operations do not use the REST `Idempotency-Key` header. A matching key and payload returns the same order. Domain failures use the normal GraphQL error response with `extensions.code` and `extensions.status`; application-level failures therefore usually retain HTTP 200 while exposing the equivalent REST status as metadata.

GraphQL's built-in `Int` scalar is signed 32-bit, so price and total fields use `Float` while validation still requires safe integer values. Stock and quantity use `Int`, matching the database's signed 32-bit range. Authentication, query-cost controls and production GraphiQL policy remain outside this local demonstration.

## Browser API exploration

NestJS serves Swagger UI at `/api/docs` and its OpenAPI 3 document at `/api/openapi.json`. The document describes the shared REST contract, request DTOs, response models, idempotency header, expected status codes and synthetic examples. Interactive requests execute against NestJS; Express remains the independent parity implementation of that contract. GraphiQL remains available directly at `/graphql`, but the operator interface presents only the REST explorer to visitors.

The local operator interface links to both explorers using `ORDERFLOW_PUBLIC_API_URL`. Public hosting requires an explicit browser-reachable API origin. The API rejects JSON bodies above 32 KB and applies in-memory per-client limits of 600 requests per minute generally and 120 mutations per minute. Rate-limit state is process-local and proxy-aware client identification is not configured until the hosting proxy is known. Anonymous data lifecycle, authentication, authorisation and durable/distributed rate limiting remain deployment decisions, not established protections.

## Non-goals

Authentication, customers, payments, shipping, fulfilment, tax, discounts, reporting dashboards, production scaling claims, and hosted deployment. The Next.js interface is an operator workflow demonstration, not a production admin system.

## Evidence and limits

Each completed scenario records the command or action, starting conditions, expected and observed results, verification date and commit, and limitations. A passing unit test alone does not establish full integration. The service split is an experiment; the modular monolith remains the default until evidence justifies a different choice.
