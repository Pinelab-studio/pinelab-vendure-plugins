# Vendure stock monitoring plugin

This plugin helps you monitor the stocklevels in two ways:

1. A dashboard widget that displays variants who's stocklevel is below a given threshold
2. An email handler that sends an email when stocklevels of a variant dropped below a given threshold

## Stocklevel widget

![Widget](https://github.com/Pinelab-studio/pinelab-vendure-plugins/raw/master/packages/vendure-plugin-stock-monitoring/docs/widget.png)

1. Add the plugin to your `vendure-config.ts` to expose a `productVariantsWithLowStock` query in the admin API.

```ts
import { StockMonitoringPlugin } from 'vendure-plugin-stock-monitoring';

StockMonitoringPlugin.init({
  threshold: 10,
});
```

2. Add the following code to add the widget to the admin ui:

```ts
import { StockMonitoringPlugin } from 'vendure-plugin-stock-monitoring';

app: compileUiExtensions({
  outputPath: path.join(__dirname, '__admin-ui'),
  extensions: [StockMonitoringPlugin.ui],
});
```

For more configuration options regarding the admin
ui, [check the docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/).

When you start the server and login, you can find `stock-levels` under the `add widgets` button.

## Low stock email handler

The email handler will send an email when the stocklevel of a variant drops below the given threshold. To activate the
handler, you can add the following handlers to your `vendure-config.ts`:

```ts
import { createLowStockEmailHandler } from "vendure-plugin-stock-monitoring";

EmailPlugin.init({
  handlers: [
    // Dynamically get email recipients based on the event
    // and send an email when stock drops below 10
    createLowStockEmailHandler({
      threshold: 10,
      subject: "Stock of variants belo 10",
      emailRecipients: async (injector, event) => {
        // Dynamically resolve email recipients with the injector and event
        const recipients = await injector.get(MyService).getAdminsForChannel(event.ctx);
        return recipients;
      }
    }),
    // Send emails to two static addresses when stock drops below 99
    createLowStockEmailHandler({
      threshold: 99,
      subject: "Stock of variants below 99",
      emailRecipients: ["test@test.com", "admin2@vendure.io"]
    })
  ],
  ...
```
