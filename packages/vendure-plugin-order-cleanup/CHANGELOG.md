# 2.0.0 (2026-09-21)

- **BREAKING:** Empty stale active orders instead of cancelling them, preserving each order and its current `AddingItems`, `Created`, or `ArrangingPayment` state.
- **BREAKING:** Remove the `GET /order-cleanup/trigger` endpoint and replace external HTTP triggering with an automatic Vendure scheduled task.
- Add configurable five-field cron, IANA timezone, and task timeout options, defaulting to daily at 03:00 in `Europe/Amsterdam` with a one-hour timeout.
- Skip orders that already have no lines, isolate per-order failures, and preserve bounded batches and the 10,000-order processing limit.
- Document the `DefaultSchedulerPlugin` prerequisite and the 1.x-to-2.x migration steps.

# 1.3.0 (2026-02-05)

- Upgraded to Vendure 3.5.3

# 1.1.2 (2025-11-13)

- Documentation update

# 1.1.1 (2025-11-06)

- Updated official documentation URL

# 1.1.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.0.0 (2025-05-21)

- Initial release
