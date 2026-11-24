# 1.0.0 (2026-11-20)

- **BREAKING:** Merged `@pinelab/vendure-plugin-content-health` into this plugin. Content health is configured via `ContentAutomationPlugin.init({ contentHealth })`, with unchanged options, helpers, events, Admin API and stored results. The content health package is no longer released. See "Upgrading to 1.0" in the README.
- **BREAKING:** Content automation UI and API require the built-in `UpdateProduct` permission. Content health UI requires `ReadProduct`; health API permissions are unchanged. No custom permissions are registered.
- **BREAKING:** The content health constants are renamed to `CONTENT_HEALTH_OPTIONS` and `contentHealthLoggerCtx`.
- Content automation and content health are independently optional: a feature that isn't configured registers no Admin API or scheduled task. Disabled features remain visible in the Dashboard. `automationStrategies` is now optional.
- Consumers that used only one of the plugins need a database migration that adds the other plugin's table. Existing tables, results and hashes are preserved.
- Added `nightlyAutomation: false`, to turn off the nightly content automation run while keeping manual runs.
- Added a "Run content automations" button in a separate product automation block, which regenerates the content of that product with every strategy that has the new optional `entityType: 'product'`. Backed by the `runContentAutomationForProduct` mutation.
- The nightly health scan (03:00) runs after content automation (02:00). This is clock ordering only: the scan doesn't wait for automation jobs to finish.

# 0.1.1 (2026-09-29)

- Initial release
