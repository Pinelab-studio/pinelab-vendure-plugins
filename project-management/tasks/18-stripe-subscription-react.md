# Stripe Subscription: Migrate history component to React

## Goal


Migrate the Stripe Subscription history component from the legacy Angular Admin UI to the new React Dashboard.

## Required Changes

- [ ] Remove the legacy Angular UI registration and history component.
- [ ] Implement the equivalent component in React under `src/dashboard/` using `@vendure/dashboard`.
- [ ] Register the extension via `defineDashboardExtension`.
- [ ] Ensure the plugin still compiles and the new React UI is accessible.


## Notes

- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
- Use Vendure's built-in components and style where possible.
