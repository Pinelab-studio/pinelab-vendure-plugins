# Stock Monitoring widget: Migrate to React Dashboard

## Goal

Migrate the Stock Monitoring widget from the legacy Angular Admin UI to the new React Dashboard.

## Required Changes

- [ ] Remove the legacy Angular UI registration and widget components.
- [ ] Implement the equivalent widget in React under `src/dashboard/` using `@vendure/dashboard`.
- [ ] Register the extension via `defineDashboardExtension`.
- [ ] Ensure the plugin still compiles and the new React widget is accessible.

## Notes

- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
- Use Vendure's built-in components and style where possible.
