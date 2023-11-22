# Vendure E-boekhouden plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-e-boekhouden)

Plugin for syncing orders to the Dutch accounting platform E-boekhouden.nl.

## Getting started

Send orders to e-Boekhouden as `GeldOntvangen` mutation and configured `account` and `contraAccount` numbers. Creates a
mutation line for each taxrate of the order's tax summary.

1. Add this to your plugin in `vendure-config.ts`:

```ts
import { EboekhoudenPlugin } from '@pinelab/vendure-plugin-e-boekhouden'

plugins: [
  EboekhoudenPlugin,
  ...
]
```

2. Run a database migration to add the config entity to your database.
3. Add this plugin to the Vendure admin ui plugin to add the configuration screen to Vendure.

```ts
plugins: [
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [EboekhoudenPlugin.ui],
    }),
  }),
];
```

You can read more about Admin UI compilation in the Vendure
[docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step)

4. Start the server and set your credentials via `Settings > E-boekhouden`

### Development - generate new client

1. Go to https://soap.e-boekhouden.nl/soap.asmx?wsdl and save the wsdl file in `src/client/e-boekhouden-wsdl.xml`.
2. Run `yarn generate-soap-client`.
3. `src/client` will now have an updated and typed soap client for e-Boekhouden.
