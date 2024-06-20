# Vendure Order Payment Extensions

## [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-payment-extensions)

This `Vendure` plugin allows an `Order` to be settled without requiring the customer to make a payment upfront.

- `settleWithoutPaymentChecker`: This checker checks if the logged in customer is in a given group, so that only its members are eligible for payment.
- `settleWithoutPaymentHandler`: This handler simply transitions the `Payment` to settled.

## Getting started

1. Add the plugin to your `vendure-config.ts`

```ts
import { PaymentExtensionsPlugin } from '@pinelab/vendure-plugin-payment-extensions';

...
plugins: [
  PaymentExtensionsPlugin
... // your other plugins
]

```

2. Start Vendure, log in, and navigate to Settings > Payment Methods
3. Choose `settleWithoutPaymentChecker` as the `Payment eligibility checker`, and then select the `CustomerGroup` whose members are expected to be eligible for this `PaymentMethod`.

4. Choose `settleWithoutPaymentHandler` as `Payment handler`
5. Click `Save`

### Test the plugin

1. Place a test order. The `PaymentMethod` you created in the `Getting Started` section should be listed under `eligiblePaymentMethods` for `Customers` who belong to the designated `CustomerGroup`. For other customers, it should not be available.
