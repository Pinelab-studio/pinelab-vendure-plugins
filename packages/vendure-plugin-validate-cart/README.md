# Vendure Validate Cart Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-validate-cart)

A very lightweight plugin to have custom cart validation rules before proceeding to checkout. For example to check current stock, or check for limited products. You can implement your own validation rules by implementing the `CartValidatorStrategy` interface.

## Getting started

Add the plugin to your config:

```ts
import { ValidateCartPlugin } from '@pinelab/vendure-plugin-validate-cart';
plugins: [ValidateCartPlugin];
```

## Storefront usage

// TODO: call mutation in cart page, and again on proceed to payment page

## Custom validation rules

You can implement your own validation rules by implementing the `CartValidatorStrategy` interface.

```ts
import { CartValidatorStrategy } from '@pinelab/vendure-plugin-validate-cart';
```
