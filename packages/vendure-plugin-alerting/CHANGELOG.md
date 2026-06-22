# 1.1.0 (2026-05-29)

- `EventAlert.notify()` now accepts async callbacks that receive `RequestContext`, `Injector`, and the event.
- Split `src/config/alert.ts` into `event-alert.ts` and `log-alert.ts` and removed the `BaseAlert` abstract class.

# 1.0.1 (2026-05-28)

- Added `EmailNotifier` for sending plain-text email alerts via Vendure's built-in email sender.
- Added error logging with try/catch in job queue processing.

# 1.0.0 (2026-05-27)

- Initial release.
- Event-based and log-based alerting.
- `WebhookNotifier` out of the box.
- Deduplication and JobQueue-backed delivery.
