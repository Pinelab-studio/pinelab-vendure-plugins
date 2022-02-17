# Vendure Plugin for generating invoices

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-myparcel/dev/@vendure/core)

Generates invoices when on `OrderPlacedEvent`. The generation of invoices happens asynchronously in the worker, so at
time of order-confirmation email it might not be available yet.

The plugin exposes an endpoint to download a PDF
invoice: `https://your-vendure-host.io/invoice/channel-token/ORDER_CODE?email=customer@email.com`, where email must be
the emailaddress of the customer connected to the order.

## Permission

This plugin adds a custom permission 'SetMyParcelConfig' that is needed to set MyParcel config via the admin interface.

## Plugin installation

Add this to your plugins in `vendure-config.ts`:

```js
InvoicePlugin.init({
  // Where to store the PDF files
  storageStrategy:
  // How to generate an invoice number
  invoiceNumberStrategy:

});
```

## How it works

1. On `OrderPlaced` an PDF invoice is generated via the worker
2. The PDF file is stored using the given StorageStrategy
3. An Invoice entity is saved in the DB with an orderCode, orderId and customerEmail
4. Any user can download the PDF via the endpoint, as long as email and orderCode match

## Contributing

Contributions always welcome!

### Dev-server

:warning: This will update the webhook in de configured MyParcel account!

1. `yarn start` starts the dev-server.
2. `localhost:3050/admin` will have an order already placed ready to be fulfilled.

### Testing

Run `yarn test` to run e2e tests

Reach out to me at [pinelab.studio](https://pinelab.studio) if you need any help.
[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
