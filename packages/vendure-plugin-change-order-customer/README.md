# Change Order Customer Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-change-order-customer)

Change Customer for Orders of all states.

## Getting started

Add this plugin to your list of plugins in your `vendure-config.ts`

```ts
import {
  ChangeOrderCustomerPlugin
} from '@pinelab/vendure-plugin-change-order-customer';

plugin:[
    ...
    ChangeOrderCustomerPlugin,
    ..
    AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [
            ChangeOrderCustomerPlugin.ui
        ],
    }),
    })
]
```
