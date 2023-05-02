# Vendure Sales Per Variant plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-sales-per-variant/dev/@vendure/core)

A plugin to measure and visualize your shop's average order value (AOV),number of orders per
month or per week and number of items per product variant for the past 12 months (or weeks) per variants.

## Getting started

1. Configure the plugin in `vendure-config.ts`:

```ts
import { SalesPerVariantPlugin } from "vendure-plugin-sales-per-variant";

plugins: [
  ...
    SalesPerVariantPlugin,
    AdminUiPlugin.init({
      port: 3002,
      route: 'admin',
      app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [SalesPerVariantPlugin.ui],
      }),
    }),
  ...
]
```

2. Start your Vendure server and login as administrator
3. You should now be able to select `product metrics` when you click on the button `add widget`

Metric results are cached in memory to prevent heavy database queries everytime a user opens its dashboard.

### Default metrics

1. Conversion Rate (CVR): this is the conversion rate of active sessions that converted to placed orders per week/month.
2. Average Order Value (AOV): The average of `order.totalWithTax` of the orders per week/month
3. Nr of orders: The number of order per week/month
