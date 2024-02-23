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
