# Vendure Google Sheet Loader plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-google-sheet-loader)

This plugin allows you to load data from a Google Sheet and handle the data in Vendure. For example, to load products and prices into Vendure.
You can define a single action per channel. This means each channel can have it's own sheet, and it's own way of handling the data from that sheet.

## Getting started

You need to have a Google API key to use this plugin. You can get one [here](https://support.google.com/googleapi/answer/6158862?hl=en).

1. Add this to your plugin in `vendure-config.ts`:

```ts
import { GoogleSheetLoaderPlugin } from '@pinelab/vendure-plugin-google-sheet-loader';

plugins: [
  GoogleSheetLoaderPlugin.init({
    strategies: [new MyDataLoadingStrategy()],
    googleApiKey: 'test-api-key',
  }),
  ...
]
```

2. Add this plugin to your Admin UI and compile.

```ts
plugins: [
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [GoogleSheetLoaderPlugin.ui],
    }),
  }),
];
```

Read more about Admin UI compilation in the Vendure
[docs](https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step)

Before you can use this plugin, you need to implement your own data loading strategy. This strategy determines what will be done with the data from the sheet.

```ts
import { RequestContext, Injector } from '@vendure/core';
import {
  GoogleSheetDataStrategy,
  SheetContent,
} from '@pinelab/vendure-plugin-google-sheet-loader';

export class MyDataLoadingStrategy implements GoogleSheetDataStrategy {
  code = 'MyDataLoadingStrategy';

  getSheetMetadata() {
    return {
      sheets: ['My tab'],
      spreadSheetId: '1gqZpM-Ksxc-xxKJAKNALAFNLLkksdalakml',
    };
  }

  validateSheetData(
    ctx: RequestContext,
    sheets: SheetContent[]
  ): boolean | string {
    // Single sheet example
    const sheet = sheets[0];
    const headerRow = sheet.data[0];
    if (headerRow[0] !== 'My Header Column') {
      return 'Expected "My Header Column" for column 1';
    }
    return true;
  }

  async handleSheetData(
    ctx: RequestContext,
    injector: Injector,
    sheets: SheetContent[]
  ): Promise<string> {
    // Do whatever you want with the data here
    // This part is executed in the worker
    return `Successfully processed ${sheets[0].data.length} rows`;
  }
}
```

## How it works

When the data loading is triggered from the product overview page in the admin UI, the plugin will:

1. Get the sheet metadata from the strategy
2. Fetch the content of the sheets
3. Validate the data, and give feedback to the admin user
4. If valid, a job will be created to handle the data
