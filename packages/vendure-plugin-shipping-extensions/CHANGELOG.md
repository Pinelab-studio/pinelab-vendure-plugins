# 3.2.2 (2025-11-13)

- Documentation update

# 3.2.1 (2025-11-06)

- Updated official documentation URL

# 3.2.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 3.1.2 (2025-05-22)

- Don't hydrate order object in `weightAndCountryChecker`, this caused tax calculations to be incorrect

# 3.1.1 (2025-04-09)

- Don't hydrate order object in `getHighestTaxRateOfOrder`, this causes discounts to be lost

# 3.1.0 (2025-03-28)

- Removed `ZoneAwareShippingCalculator`
- Added `flatRateSurchargeFn` to add surcharges to the Flat Rate calculator based on custom logic

# 3.0.0 (2025-03-24)

- Deprecated `ZoneAwareShippingCalculator`. Tax of shipping should be dependent on items in cart.
- Added `FlatRateItemBasedShippingCalculator`: Flat rate shipping calculator with tax based on the items in cart.
- Added additional eligibility strategies, to make the shipping checkers in this plugin not eligible based on consumers custom logic.

# 2.9.0 (2025-01-16)

- Added new shipping checker: Check by country and facet values
- Optimization of the Weight and Country checker: Hydrate all `lines.productVariant.product` in one call.

# 2.8.0 (2024-12-19)

- Update Vendure to 3.1.1

# 2.7.2 (2024-08-12)

- Resolve to channels default tax zone if no tax rate found

# 2.7.1 (2024-08-04)

- Update compatibility range (#480)

# 2.7.0 (2024-06-21)

- Added zone aware shipping calculator and tax category form input component

# 2.6.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 2.5.2 (2024-05-07)

- Fix #417

# 2.5.1 (2024-02-26)

- Include `RequestContext` as an additional argument to `ShippingExtensionsOptions.weightCalculationFunction`

# 2.5.0 (2024-02-19)

- Made `ShippingExtensionsOptions.weightCalculationFunction` async and accept `Injector` as an additional argument

# 2.4.1 (2024-02-22)

- Don't log errors when invalid postalcode for UK strategy
- Distance based strategies are allowed to return an undefined geolocation

# 2.4.0 (2024-02-14)

- Added `orderInCountryPromotionCondition`, which checks if the order's shipping country matches one of the configured countries

# 2.3.0 (2024-02-09)

- Added minimum price instead of fallback price.
- Fallback was removed in favor of a minimum price

# 2.2.0 (2024-02-08)

- Allow setting a fallback price for distance based calculator

# 2.1.0 (2024-02-08)

- Allow a custom weightCalculationFunction

# 2.0.1 (2024-02-08)

- Docs update

# 2.0.0 (2024-01-29)

- Added distance based `ShippingCalculator`
- Introduced `OrderAddressToGeolocationConversionStrategy`

# 1.1.0 (2023-10-24)

- Updated vendure to 2.1.1
