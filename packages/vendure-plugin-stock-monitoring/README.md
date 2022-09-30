# Vendure stock monitoring plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-stock-monitoring/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-stock-monitoring)

This plugin helps you monitor the stocklevels in two ways:

1. A dashboard widget that displays variants who's stocklevel is below a given threshold
2. An email handler that sends an email when stocklevels of a variant dropped below a given threshold

## Getting started

1. Add the plugin to your `vendure-config.ts` to expose a `productVariantsWithLowStock` query in the admin API.

```ts
import { StockMonitoringPlugin } from 'vendure-plugin-stock-monitoring';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';

plugins: [
  StockMonitoringPlugin.init({
    threshold: 10,
  }),
  // Add the widget to the admin ui
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [StockMonitoringPlugin.ui],
    }),
  }),
];
```

For more configuration options regarding the admin
ui, [check the docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/).

When you start the server and login, you can find `stock-levels` under the `add widgets` button.

### Low stock email handler

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

Create a template file for the low stock email in `static/email/templates/low-stock/body.hbs` with the following
content:

```handlebars
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size='30px'>Low stocknotification</mj-text>
        <mj-divider border-color='#343434'></mj-divider>

        <mj-text>
          These products are low on stock:
          <br />
          <br />
          {{#each lines}}
            <a href='http://localhost:3050/admin/products/'>
              {{productVariant.name}}
              -
              {{productVariant.stockOnHand}}
              pc.
            </a>
            <br />
          {{/each}}
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
```
