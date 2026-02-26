# 1.4.1 (2026-02-20)

- Include raw .tsx components for React Extension distribution

# 1.4.0 (2026-02-13)

- Add pagination support for querying adjustments on wallets.
- BREAKING: `wallet.adjustments` is now paginated, that means you need to query `adjustments { items { ...fields } }` instead of `adjustments { ...fields }`;

# 1.3.0 (2026-02-12)

- Added metadata field on a wallet for custom data

# 1.2.0 (2026-02-12)

- Added dashboard components for managing wallets and balance on the customer detail page.
- BREAKING: DB migration required, balance is now defined as `Money` to prevent rounding errors.

# 1.1.0 (2026-02-03)

- Accept amount as input to the store credit payment handler, to partially pay for an order with store credit
- Export helper functions to populate wallets for customers
- BREAKING: DB migration required: Customers can not have multiple wallets with the same name

# 1.0.0 (2026-02-03)

- Initial release
