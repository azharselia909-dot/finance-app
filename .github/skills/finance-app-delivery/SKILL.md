---
name: finance-app-delivery
description: "Use when creating or extending the FastAPI and React finance application, especially for authenticated features, transaction flows, data validation, pagination, rate limiting, background jobs, migrations, testing, and production reliability."
---

# Finance Application Delivery

Use this checklist to turn a feature request into a reliable implementation. Keep the task list proportional to risk: complete every relevant item, and mark skipped items with a reason.

## Task List

### 1. Define the contract

- [ ] Write the user outcome, non-goals, acceptance criteria, and compatibility constraints.
- [ ] Define request, response, error, authentication, pagination, filtering, sorting, and idempotency semantics.
- [ ] Identify data sensitivity, authorization rules, expected traffic, latency target, and availability expectations.
- [ ] List malformed input, boundary values, duplicate requests, retries, concurrent requests, expired tokens, and partial-failure cases.

### 2. Inspect and plan

- [ ] Locate the owning backend route/service/model and the owning frontend page/API client/state path.
- [ ] Inspect existing tests, scripts, migrations, environment configuration, and current git changes.
- [ ] Choose the smallest design consistent with current FastAPI, SQLAlchemy, React, and Axios patterns.
- [ ] Split work into schema, persistence, API, UI, tests, observability, and rollout tasks where applicable.

### 3. Design persistence safely

- [ ] Add explicit types, nullability, indexes, uniqueness constraints, foreign keys, and ownership relationships.
- [ ] Use a migration and reversible/backfillable steps; do not mutate schema during application import.
- [ ] Define transaction boundaries and rollback behavior for every multi-write operation.
- [ ] Decide how duplicates, stale updates, deleted users, orphaned jobs, and legacy rows are handled.

### 4. Implement backend correctness

- [ ] Validate and normalize all external input server-side with bounded fields and domain rules.
- [ ] Enforce authentication and user ownership in every read, write, export, and job-enqueue path.
- [ ] Bound list queries and make pagination stable with deterministic ordering.
- [ ] Return intentional status codes and safe error details; avoid leaking whether sensitive accounts or records exist.
- [ ] Keep secrets in environment/configuration, use secure password hashing, and reject insecure production defaults.
- [ ] Add structured logs and request/job correlation IDs without recording secrets or unnecessary financial data.

### 5. Add abuse and workload controls

- [ ] Rate-limit login, registration, password recovery, exports, imports, and expensive report endpoints.
- [ ] Define the rate-limit key, storage scope, window, response headers, and `429` behavior.
- [ ] Ensure rate limits remain useful behind proxies and cannot be bypassed by changing casing, headers, or trivial identifiers.
- [ ] Add request body, page size, upload, query complexity, and execution time limits.
- [ ] Add timeouts and bounded retries for every external dependency.

### 6. Design background work correctly

- [ ] Move long-running exports, reports, imports, notifications, and scheduled aggregation out of request handlers.
- [ ] Persist job state such as queued, running, succeeded, failed, cancelled, attempts, timestamps, and safe error summary.
- [ ] Authenticate job creation and status access; scope jobs to the owning user.
- [ ] Make workers idempotent and safe under duplicate delivery, restart, timeout, and cancellation.
- [ ] Use bounded exponential backoff, a maximum attempt count, and a dead-letter/manual recovery path.
- [ ] Expose progress or polling semantics without busy loops, and clean up expired results and stale jobs.

### 7. Implement frontend resilience

- [ ] Mirror server contracts in form constraints without treating client validation as security.
- [ ] Disable or guard duplicate submissions and define behavior for refresh, navigation, retries, and stale responses.
- [ ] Handle loading, empty, validation, unauthorized, forbidden, rate-limited, timeout, server-error, and offline states.
- [ ] Clear or refresh sensitive state after logout and handle expired tokens consistently.
- [ ] Keep pagination, filters, sorting, optimistic updates, and error recovery predictable and accessible.

### 8. Test the risk surface

- [ ] Add unit tests for validation, normalization, calculations, retry policy, and job idempotency.
- [ ] Add API tests for authentication, ownership isolation, pagination bounds, status codes, and transaction rollback.
- [ ] Add tests for duplicate/replayed writes, concurrent updates, expired tokens, malformed JSON, and oversized input.
- [ ] Add rate-limit tests and background-job tests for retry, duplicate delivery, cancellation, and permanent failure.
- [ ] Add frontend tests for submit guards, stale requests, auth expiry, API errors, and empty/loading states.
- [ ] Run backend tests/type checks, frontend lint/build, and a smoke test for the changed workflow.

### 9. Release and operate

- [ ] Document environment variables, migrations, worker processes, scheduler needs, and rollback steps.
- [ ] Define health/readiness checks and metrics for request latency, error rate, rate-limit responses, queue depth, job age, retries, and failures.
- [ ] Confirm CORS, cookie/token, HTTPS, proxy, database pool, and production secret settings.
- [ ] Use a staged rollout or feature flag for risky schema, queue, import, or reporting changes.
- [ ] Record remaining risks, follow-up work, and the exact validation commands in the final report.

## Acceptance Gate

Do not call the work complete if any of these are unknown:

- Who is allowed to access or mutate the data.
- What happens on invalid, repeated, delayed, cancelled, or partially failed requests.
- Whether expensive work is bounded or moved to a durable job.
- How the user sees and recovers from each failure state.
- Which executable checks prove the change works and what remains untested.

## Suggested Task Output

Before editing, produce:

```text
Goal:
Acceptance criteria:
Affected layers:
Security and ownership rules:
Rate/job requirements:
Edge cases:
Validation commands:
```

After editing, report:

```text
Implemented:
Validation run:
Migration/deployment notes:
Remaining risks:
```