# Vendure Klaviyo Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-invoices)

An extensible plugin for sending placed orders to the Klaviyo marketing platform.

## Getting started

The default setup will only send placed orders to Klaviyo

1. Log in to your Klaviyo account and get your API key
2. Add the following config to your `vendure-config.ts`:

```ts
import { KlaviyoPlugin } from '@pinelab/vendure-plugin-klaviyo';

plugins: [
  KlaviyoPlugin.init({
    apiKey: 'some_private_api_key',
  }),
];
```

All placed orders will now be synced.

## Custom event handlers

If you want to send more events to Klaviyo, you can implement your own handlers. For example, syncing account verification events to Klaviyo, so that you can send out welcome e-mails:

1. Create a custom handler `klaviyo-account-verified-handler.ts`

   ```ts
   import { AccountVerifiedEvent } from '@vendure/core';
   import {
     KlaviyoEventHandler,
     KlaviyoGenericEvent,
   } from '@pinelab/vendure-plugin-klaviyo';

   /**
    * Event handler to send Vendure's AccountVerifiedEvent to Klaviyo
    */
   export const accountVerifiedHandler: KlaviyoEventHandler<AccountVerifiedEvent> =
     {
       vendureEvent: AccountVerifiedEvent,
       mapToKlaviyoEvent: async (event, injector) => {
         const { customer } = event;
         return <KlaviyoGenericEvent>{
           // Unique ID per event to make the event idempotent
           uniqueId: `account-verified-${customer.id}-${Date.now()}`,
           eventName: 'Account Verified',
           profile: {
             emailAddress: customer.emailAddress,
             externalId: customer.id.toString(),
             firstName: customer.firstName,
             lastName: customer.lastName,
           },
           eventProperties: {
             myCustomProperty: 'my custom value',
           },
         };
       },
     };
   ```

2. Register the handler in the plugin in your `vendure-config.ts`

   ```ts
   import {
     defaultOrderPlacedEventHandler,
     KlaviyoPlugin,
   } from '@pinelab/vendure-plugin-klaviyo';
   import { accountVerifiedHandler } from './klaviyo-account-verified-handler.ts';

   plugins: [
     KlaviyoPlugin.init({
       apiKey: 'some_private_api_key',
       eventHandlers: [defaultOrderPlacedEventHandler, accountVerifiedHandler],
     }),
   ];
   ```

## Custom data in Klaviyo's default Order Placed event

If you'd like to send custom data in the Klaviyo native Order Placed event, you can also create a custom handler, but make sure to return a `KlaviyoOrderPlacedEvent` instead of a `KlaviyoGenericEvent`. The plugin will recognize your return type and handle it as an Order Placed event.

Don't forget to exclude the default order placed handler if you do!

```ts
     KlaviyoPlugin.init({
       apiKey: 'some_private_api_key',
       // No defaultOrderPlacedHandler here!
       eventHandlers: [customOrderPlacedHandler],
     }),
```

## Abandoned cart emails

This plugin includes a mutation `klaviyoCheckoutStarted`, which can be called from your storefront. When called, and an active order is present, it sends a custom event `Checkout Started` to Klaviyo, including basic order and profile data. This event can be used to set up abandoned cart email flows in Klaviyo.

## Refund and Cancellation Events

This plugin includes a mutation `klaviyoRefundCreated`, which sends events to Klaviyo whenever a refund is created for an order.

To enable the refund event, add the refund handler to the plugin config:

```ts
import {
  KlaviyoPlugin,
  createRefundHandler,
} from '@pinelab/vendure-plugin-klaviyo';

plugins: [
  KlaviyoPlugin.init({
    apiKey: 'some_private_api_key',
    eventHandlers: [
      createRefundHandler({
        getPaymentMethodName: (payment) => {
          // This sample gets the payment method (like 'iDeal') when a the settled payment was a Mollie payment
          return payment?.metadata.method;
        },
      }),
    ],
  }),
];
```

## Newsletter signup

The following mutation allows a customer to sign up to a Klaviyo Audience list via the API:

```graphql
mutation {
  subscribeToKlaviyoList(
    emailAddress: "testing@pinelab.studio"
    listId: "WpeFJd"
  )
}
```

This mutation requires an active session, which means a customer should have interacted with the Vendure API already. This can be done for example by fetching an active order. This is to prevent unwanted bot sign ups. The customer will also receive a double opt-in email, asking them to confirm signing up for marketing emails.
