# Google Sheet Loader: Migrate action bar dropdown to React

## Goal


Migrate the Google Sheet Loader action bar dropdown button from the legacy Angular Admin UI to the new React Dashboard.

## Required Changes

- [ ] Remove the legacy Angular UI registration and action bar component.
- [ ] Add a React action bar dropdown item via `addActionBarDropdownMenuItem`.
- [ ] Ensure the plugin still compiles and the button is visible in the React Dashboard.


## Notes

- Use `addActionBarDropdownMenuItem` (not `addActionBarItem`).
- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
