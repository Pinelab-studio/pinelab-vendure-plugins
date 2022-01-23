# Vendure Plugin for syncing orders to MyParcel

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-myparcel/dev/@vendure/core)

Sends orders to MyParcel on fulfillment.

## Permission
This plugin adds a custom permission 'SetMyParcelConfig' that is needed to set MyParcel config via the admin interface.

## Plugin installation
Add this to your plugins in `vendure-config.ts`:

```js
MyparcelPlugin.init(
  {
    vendureHost: 'https://your-vendure-host.io'
  },
);
```

1. Create a shipmentMethod with `MyParcel fulfillment`.
2. Place an order and select the shippingMethod.
3. Go to the Admin UI and click on `fulfill`
4. Your shipment should be in your MyParcel account.

Reach out to me at [pinelab.studio](https://pinelab.studio) if you need any help.

## Contributing

Contributions always welcome!

### Dev-server

:warning: This will update the webhook in de configured MyParcel account!

1. `yarn start` starts the dev-server.
2. `localhost:3050/admin` will have an order already placed ready to be fulfilled.

### Testing

Run `yarn test` to run e2e tests

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
