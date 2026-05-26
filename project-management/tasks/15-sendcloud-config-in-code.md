# Sendcloud plugin: Move configuration to code, remove all UI

## Goal


Move the Sendcloud configuration from the UI/admin to plugin initialization code, remove the custom history entry, and replace it with a private order note. After this, the plugin should have no UI at all.

## Required Changes

- [ ] Add `getSendcloudConfig(ctx): Config | false` to plugin options.
- [ ] Remove the legacy Angular UI completely (both the module registration and any components).
- [ ] Remove the custom history entry; use the built-in private "add note to order" feature instead.
- [ ] Update `README.md` with the new code-based configuration example.
- [ ] Ensure the plugin still compiles and works with the new config pattern.


## Notes

- Follow the same pattern used by other plugins that already moved config to code (e.g., Shipmate).
- The function may return `false` to disable the plugin for a given request.
