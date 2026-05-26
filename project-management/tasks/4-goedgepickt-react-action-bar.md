# Goedgepickt plugin: Remove legacy UI, add React action bar dropdown

## Goal


Remove the legacy Angular UI (history entry) and replace it with a React Dashboard action bar dropdown menu item on the order detail page.

## Required Changes

- [ ] Remove the legacy Angular UI registration and the history entry component.
- [ ] Use the built-in private "add note to order" feature instead of the custom history entry.
- [ ] Add a React action bar dropdown item via `addActionBarDropdownMenuItem` on the order detail page.
- [ ] Label the item **"Push to Goedgepickt"**.
- [ ] Clicking it should trigger the `syncOrderToGoedgepickt` mutation.
- [ ] Ensure the plugin still compiles and the button is visible.


## Notes

- Use `addActionBarDropdownMenuItem` (not `addActionBarItem`).
- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
