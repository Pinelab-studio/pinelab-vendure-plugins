# UTM Tracker: Migrate to React Dashboard

## Goal

Migrate the UTM Tracker plugin UI from the legacy Angular Admin UI to the new React Dashboard.

## Required Changes

- [ ] Remove the legacy Angular UI registration and components.
- [ ] Implement the equivalent UI in React under `src/dashboard/` using `@vendure/dashboard`.
- [ ] Register the extension via `defineDashboardExtension`.
- [ ] Ensure the plugin still compiles and the new React UI is accessible.

## Notes

- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
- Use Vendure's built-in components and style where possible.
