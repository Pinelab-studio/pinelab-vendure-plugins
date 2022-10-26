# Vendure Metrics plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-metrics/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-metrics)

A plugin to measure and visualize your shop's conversion rate (CRV), average order value (AOV) and number of orders per
month.

## Getting started

1. Configure the plugin in `vendure-config.ts`:

```ts
import { MetricsPlugin } from "vendure-plugin-metrics";

plugins: [
  ...
  MetricsPlugin,
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [MetricsPlugin.ui],
    }),
  }),
  ...
]
```

2. Start your Vendure server and login as administrator
3. You should now be able to select `metrics` when you click on the button `add widget`

### Default metrics

1. Conversion Rate (CVR): this is the conversion rate of active sessions that converted to placed orders.
2. Average Order Value (AOV):
