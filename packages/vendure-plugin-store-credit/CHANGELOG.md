# 1.6.0 (2026-22-05)

- Upgraded to Vendure 3.6.2

# 1.5.0 (2026-04-15)

- Added support for `Wallet` based Gift Cards
- Security: `walletByCode` is now channel-scoped, returns `null` for unknown codes, requires `UpdateOrder` on the admin API and an active order on the shop API (to prevent enumeration attacks)
- Security: wallet debits are now performed atomically to prevent race conditions / double-spend
- BREAKING: `WalletService.create` now throws when neither `customerId` nor `code` is provided. The admin `CreateWalletInput` has a new optional `code` field; pass a code explicitly when creating a wallet without a customer
- BREAKING: the admin `giftCardWallets` query now requires the `ReadCustomer` permission
- The removed unique index on `wallet.name` allows duplicate wallet names across customers

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
