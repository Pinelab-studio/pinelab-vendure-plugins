# Vendure Client

A typed, extensible, framework-agnostic client for managing active orders and checkout with Vendure. This package aims to do most of the efault logic related to active order and checkout management, so that you can focus on presentation with your favorite framework.

- Sensible, but extendable default GraphQL fields.
- Active order state management.
- Customer session management.
- Emit typed events based on order mutations like `item-added`, `customer-added`. See [Events](###Events) for more

It uses the framework agnostic, and very tiny packages

- [nanostores](https://github.com/nanostores/nanostores) (334 bytes) for state management. Nanostores has integrations for React, Vue, Svelte, Angular and more
- [mitt](https://www.npmjs.com/package/mitt) (200 bytes) for event emitting

This package should only be used client side, i.e. for fetching an active order, adding to cart, adding shipping details etc. Handling catalog data, like fetching products and collections, should be handled by your SSR/SSG middleware, like Nuxt, Next.js, Astro or _\<insert your favorite framework here\>_

## Getting started

```ts
import { VendureOrderClient } from 'vendure-order-client';

const client = new VendureOrderClient(
  'http://localhost:3050/shop-api',
  'your-channel-token'
);

await client.addItemToOrder('some-id', 1);

// Make this reactive with one of Nanostores' integrations
const total = client.activeOrder.totalWithTax;
```

## Add your own graphql fields

You can easily include your own GraphQL fields in the active order mutations and queries. Let's say you have a custom field `referralCode` on an order:

```ts
import { VendureOrderClient } from 'vendure-order-client';

// Make sure the fragment name is 'AdditionalOrderFields'
const referralCodeFragment = gql`
  {
    fragment
    AdditionalOrderFields
    on
    Order {
      referralCode
    }
  }
`;

interface OrderWithReferralCode {
  referralCode: string;
}

const client = new VendureOrderClient<OrderWithReferralCode>(
  'http://localhost:3050/shop-api',
  'your-channel-token',
  referralCodeFragment
);

await client.addItemToOrder('some-id', 1);
// Typescript will now know you also have `referralCode` available
const referralCode = client.activeOrder.referralCode;
```

## Extend the client

You can easily add your own queries and mutations by extending this client:

```ts
import { Id, VendureOrderClient } from 'vendure-order-client';
import { gql } from 'graphql-request';

class MyOrderClient extends VendureOrderClient {
  /**
   * Some custom query
   */
  async myOwnQuery(): Promise<any> {
    return await this.rawRequest<any>(gql`
      query {
        someCustomQuery {
          id
          name
        }
      }
    `);
  }
}
```

## Events

This client uses a global eventbus, so that you can, for example, show a notification when an item is added to cart.

```ts
import { VendureOrderClient, VendureOrderEvents } from 'vendure-order-client';

function showNotification(type: string, e: VendureOrderEvents['item-added']) {
  console.log(type); // 'item-added'
  this.snackbar.showNotification(`${e.quantity} item added to cart`);
}

// Events are all typed. Import `VendureOrderEvents` to see all available events
client.eventBus.on('item-added', showNotification);

await client.addItemToOrder('some-id', 1); // Shows notification '1 item added to cart'

// Don't forget to unsubscribe on component destroy
client.eventBus.off('item-added', showNotification);
```

### List of events

```ts
// Checkout VendureOrderEvents for all available events
import { VendureOrderEvents } from 'vendure-order-client';
```
