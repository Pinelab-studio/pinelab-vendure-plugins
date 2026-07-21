# Vendure E-boekhouden plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-e-boekhouden)

Plugin for syncing orders to the Dutch accounting platform E-boekhouden.nl.

## Getting started

Send orders to e-Boekhouden as `GeldOntvangen` mutation and configured `account` and `contraAccount` numbers. Creates a
mutation line for each taxrate of the order's tax summary.

1. Add this to your plugin in `vendure-config.ts`:

```ts
import { EboekhoudenPlugin } from '@pinelab/vendure-plugin-e-boekhouden'

plugins: [
  EboekhoudenPlugin.init({
    getTaxCode: (ctx, order, taxRate) => {
      if (order.customFields.VatID && taxRate == 0) {
        return 'VERL_VERK'; // Reverse charge for EU sales
      } else if (taxRate == 21) {
        return 'HOOG_VERK_21';
      } else if (taxRate == 9) {
        return 'LAAG_VERK_9';
      } else {
        Logger.error(`Unknown tax rate ${taxRate} for order ${order.code}`);
        return 'GEEN';
      }
    },
  }),
  ...
]
```

2. Start the server and go to `Settings` > `Channels`, open the channel you want
   to configure and select the **E-boekhouden** tab. Tick `Enabled` and fill in
   your `Username`, `Security code 1`, `Security code 2`, `Account` and
   `Contra account`. Credentials are stored per channel as Channel custom fields.

> The `eBoekhoudenEnabled` toggle controls whether e-Boekhouden is active for a
> channel. When it is off (or the config is incomplete), the plugin is disabled
> for that channel.

### Development - generate new client

1. Go to https://soap.e-boekhouden.nl/soap.asmx?wsdl and save the wsdl file in `src/client/e-boekhouden-wsdl.xml`.
2. Run `yarn generate-soap-client`.
3. `src/client` will now have an updated and typed soap client for e-Boekhouden.
