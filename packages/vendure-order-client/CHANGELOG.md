# 2.8.2 (2023-12-01)

- Updated `getActiveCustomer` to get default billing and shipping addresses

# 2.8.1 (2023-12-01)

- Added `pollOrderByCode` to poll for order every second

# 2.8.0 (2024-01-04)

- Added `getActiveCustomer` and `logout()` functions;
- Removed `$currentUser` and `$eligibleShippingMethods` stores for simplicity. You should manually fetch that data in your project where needed.

# 2.7.0 (2023-12-06)

- Added `getMolliePaymentMethods` query

# 2.6.1 (2023-12-01)

- Expose getEligibleShippingMethods

# 2.6.0

- Make VendureOrderClient.updateEligibleShippingMethods public
- export the store helpers

# 2.5.0

- Export vendure graphql types
- Fixed outdated readme

# 2.4.0 (2023-11-09)

- Add mollie payment intent creation vendure client
- Updated vendure to 2.1.2

# 2.3.0 (2023-10-24)

- Updated vendure to 2.1.1

# 2.2.0 (2023-10-03)

- Added Eligible Shipping Method store with value, loading state and error([#265](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/265))

# 2.1.0 (2023-09-20)

- Added loading states for currentUser and activeOrder store ([#256](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/256))
