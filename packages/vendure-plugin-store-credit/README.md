# Vendure Store Credit Plugin

A plugin for channel-aware store credit wallets with ledger tracking. Customers can use wallet balance as a payment method at checkout.

## Installation

```bash
npm i @pinelab/vendure-plugin-store-credit
```

```ts
// vendure-config.ts
import { StoreCreditPlugin } from '@pinelab/vendure-plugin-store-credit';

plugins: [StoreCreditPlugin],
```

Run a migration to add the Wallet entities, then create a Payment Method in the admin using the `store-credit` handler.

## Admin API

These functions are available in the admin API.

### Create wallet

Each customer can have multiple wallets. This mutation creates a new wallet for the customer. Starting balance is always 0.

```graphql
mutation CreateWallet($input: CreateWalletInput!) {
  createWallet(input: $input) {
    id
    name
    balance
    currencyCode
    adjustments {
      id
      amount
    }
  }
}
# Variables: { "input": { "customerId": "1", "name": "Gift card" } }
```

### Set balance (add or subtract)

```graphql
mutation AdjustBalance($input: AdjustBalanceForWalletInput!) {
  adjustBalanceForWallet(input: $input) {
    id
    balance
  }
}
# Variables: { "input": { "walletId": "1", "amount": 1500 } }
# Amount in minor units (1500 = €15.00). Use negative for deductions.
```

### Refund payment to store credit

An admin can choose to refund any payment to store credit wiht the custom `refundPaymentToStoreCredit` mutation:

```graphql
mutation RefundToStoreCredit($paymentId: ID!, $walletId: ID!) {
  refundPaymentToStoreCredit(paymentId: $paymentId, walletId: $walletId) {
    id
    balance
  }
}
```

To refund a payment that was made with store credit, you can use the built-in `refundOrder` mutation supplied by Vendure. In this case it will refund the store credit to the same wallet that was used to make the payment.

## Storefront usage

Customers can pay for orders using their store credit balance.

```graphql
mutation {
  addPaymentToOrder(
    input: { method: "store-credit", metadata: { walletId: "1" } }
  ) {
    ... on Order {
      id
      code
    }
  }
}
```

Optionally, a customer can choose to partially pay for an order by specifying the amount to pay with store credit.

```graphql
mutation {
  addPaymentToOrder(
    input: {
      method: "store-credit"
      metadata: { walletId: "1", amount: 100000 }
    }
  ) {
    ... on Order {
      id
      code
    }
  }
}
```

Logged-in customers can fetch their wallets via `activeCustomer`:

```graphql
query MyWallets {
  activeCustomer {
    id
    wallets {
      items {
        id
        name
        balance
        currencyCode
        adjustments {
          amount
        }
      }
      totalItems
    }
  }
}
```

Or query a single wallet by ID:

```graphql
query Wallet($id: ID!) {
  wallet(id: $id) {
    id
    name
    balance
    currencyCode
    adjustments {
      id
      amount
      createdAt
    }
  }
}
```

# Helper scripts

You can create wallets with a specified balance for all (or given) customers with the following script that is included:

```ts
import { bootstrap } from '@vendure/core';
import { createWalletsForCustomers } from '@pinelab/vendure-plugin-store-credit';
import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE });

// Import vendure config after dotenv.config() so env variables are available in config
import('./vendure-config')
  .then(async ({ config }) => {
    const app = await bootstrap(config);
    const wallets = await createWalletsForCustomers(
      app,
      // Details for all wallets
      {
        name: 'Special promotion wallet',
        balance: 123456,
        balanceDescription: 'Special promotion credits',
      },
      // Administrator email address to use for record-keeping
      'admin@example.com',
      // A list of customer email addresses to create wallets for. If omitted, all customers get a wallet.
      undefined
    );
    console.log(`Created ${wallets.length} wallets`);
    await app.close();
  })
  .catch((err) => {
    console.error(err);
  });
```

# FAQ

## Can I create a wallet with an initial starting balance?

To create a wallet with an initial starting balance, you can create a wallet for a customer on the customer detail page in the admin dashboard. Wallets always start with a balance of 0, but you can adjust the balance to anything you want after creation. Wallets always start with 0, so that you can recalculate the current balance by 'rerunning' all the adjustments.
