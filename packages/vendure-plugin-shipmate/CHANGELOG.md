# 1.5.2 (2025-11-13)

- Documentation update

# 1.5.1 (2025-11-06)

- Updated official documentation URL

# 1.5.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.4.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.3.2 (2024-09-27)

- Include catch-unknown dependency

# 1.3.1 (2024-09-27)

- Hydrate sensible relations before passing order into `shouldSendOrder`

# 1.3.0 (2024-09-27)

- Add `ShipmatePluginConfig.shouldSendOrder` (#498)

# 1.2.5 (2024-08-27)

- Don't throw erros from `/shipmate` endpoint (#509)

# 1.2.4 (2024-08-20)

- Divide by 100 when passing `OrderLine.proratedUnitPriceWithTax` to `Items.item_value`

# 1.2.3 (2024-08-20)

- Log warning when failed to cancel a shipment in Shipmate

# 1.2.2 (2024-08-04)

- Update compatibility range (#480)

# 1.2.1 (2024-07-03)

- Slice all string fields in Shipmate payload to 40 characters

# 1.2.0 (2024-07-03)

- Cancel and Recreate Shipment when Order is modified

# 1.1.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.0.5 (2024-06-13)

- Don't throw errors when an order doesn't exist, but log and return. This can happen because shipments are also manually created in Shipmate.

# 1.0.4 (2024-06-12)

- Removed unused @Index(), because a unique constraint was already present

# 1.0.3 (2024-06-12)

- Removed unused custom field `order.shipmateReference`

# 1.0.2 (2024-06-12)

- Exporting plugin, services and entities in the main package

# 1.0.1 (2024-06-12)

- Correctly copy admin UI files to dist

# 1.0.0 (2024-06-12)

- Initial setup of the plugin.
