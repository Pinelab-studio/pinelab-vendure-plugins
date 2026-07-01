# 1.3.1 (2026-07-01)

- Fixed error `The property totalQuantity on the Order entity requires the Order.lines relation to be joined` when querying calculated Order fields (e.g. `totalQuantity`, `total`, `totalWithTax`, `subTotal`) on the `validateActiveOrder` result. The `lines` relation is now always joined when refetching the order.

# 1.3.0 (2026-07-01)

- `validateActiveOrder` now returns a `ValidateActiveOrderResult` object with both `errors` and `order` fields.
- The active order is refetched after validation, so any modifications made by a custom validation strategy are reflected in the returned order.
- Uses Vendure's built-in `@Relations` decorator to load the requested order relations in the response.
- **Breaking change:** The `validateActiveOrder` mutation return type changed from `[ActiveOrderValidationError!]!` to `ValidateActiveOrderResult!`.

# 1.2.0 (2026-08-05)

- Upgraded to Vendure 3.6.3

# 1.1.0 (2026-02-05)

- Upgraded to Vendure 3.5.3

# 1.0.3 (2025-11-13)

- Documentation update

# 1.0.2 (2025-11-06)

- Updated official documentation URL

# 1.0.1 (2025-10-28)

- Fixed type declaration in package.json

# 1.0.0 (2025-09-24)

- Initial release
