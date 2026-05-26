# Modify Customer Orders: Migrate single action bar button to React

## Goal


Migrate the single legacy Angular action bar button of the Modify Customer Orders plugin to a React Dashboard action bar dropdown menu item.

## Required Changes

- [ ] Remove the legacy Angular UI registration and action bar component.
- [ ] Add a React action bar dropdown item via `addActionBarDropdownMenuItem`.
- [ ] Ensure the plugin still compiles and the button is visible in the React Dashboard.


## Notes

- Use `addActionBarDropdownMenuItem` (not `addActionBarItem`).
- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
