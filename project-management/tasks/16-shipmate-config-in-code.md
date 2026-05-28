# Shipmate plugin: Move configuration to code

## Goal

Move the Shipmate configuration from the UI/admin to plugin initialization code via a strategy function.

## Required Changes

- [ ] Add `getShipmateConfig(ctx): Config | false` to plugin options.
- [ ] Remove the legacy Angular UI completely (both the module registration and any components).
- [ ] Update `README.md` with the new code-based configuration example.
- [ ] Ensure the plugin still compiles and works with the new config pattern.

## Notes

- Follow the same pattern used by other plugins that already moved config to code (e.g., Sendcloud).
- The function may return `false` to disable the plugin for a given request.
