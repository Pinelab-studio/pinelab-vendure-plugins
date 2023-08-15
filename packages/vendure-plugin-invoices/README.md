# Vendure Plugin for generating invoices

![Vendure version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPinelab-studio%2Fpinelab-vendure-plugins%2Fmain%2Fpackage.json&query=$.devDependencies[%27@vendure/core%27]&colorB=blue&label=Built%20on%20Vendure)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-invoices)

A plugin for generating PDF invoices for placed orders.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
plugins: [
  InvoicePlugin.init({
    /**
     * This plugins requires a license for commercial use.
     * Visit https://pinelab-plugins.com/vendure-plugin-invoices
     * for more information
     */
    licenseKey: processs.env.LICENSE,
    // Used for generating download URLS for the admin ui
    vendureHost: 'http://localhost:3106',
  }),
  // Add the invoices page to the admin ui
  AdminUiPlugin.init({
    port: 3002,
    route: 'admin',
    app: compileUiExtensions({
      outputPath: path.join(__dirname, '__admin-ui'),
      extensions: [InvoicePlugin.ui],
    }),
  }),
];
```

2. Run a [migration](https://www.vendure.io/docs/developer-guide/migrations/), to add the Invoice and InvoiceConfig
   entities to the database.
3. Start Vendure and login to the admin dashboard
4. Make sure you have the permission `AllowInvoicesPermission`
5. Go to `Sales > Invoices`.
6. Unfold the `Settings` accordion.
7. Check the checkbox to `Enable invoice generation` for the current channel on order placement.
8. A default HTML template is set for you. Click the `Preview` button to view a sample PDF invoice.

## Adding invoices to your order-confirmation email

Add the following link to your email template:

`https://<your server>/invoices/e2e-default-channel/C7YH7WME4LTQNFRZ?email=hayden.zieme12@hotmail.com`.

When the customer clicks the link, the server will check if the `ordercode`, `channelCode` and `customer emailaddress`
match with the requested order. If so, it will return the invoice.

## Increase invoice template DB storage

By default, the plugin uses TypeOrm's `text` to store the invoice template in the DB. This might not be enough, for example when you'd like to add base64 encoded images to your invoices. This will result in the error `ER_DATA_TOO_LONG: Data too long for column 'templateString'`. You can specify your DB engine with an env variable, and the plugin will resolve the correct column type:

```shell
# E.g. For mysql the column type 'longtext' will be used, which supports up to 4gb
INVOICES_PLUGIN_DB_ENGINE=mysql
```

Don't forget to run a DB migration after! Checkout https://orkhan.gitbook.io/typeorm/docs/entities for available databases and column types.

## Google Storage strategy

This plugin also includes a strategy for storing invoices in Google Storage:

`yarn add @google-cloud/storage`

```ts
// In vendure-config.ts
InvoicePlugin.init({
  vendureHost: 'http://localhost:3050',
  storageStrategy: new GoogleStorageInvoiceStrategy({
    bucketName: 'bucketname',
  }),
});
```

- [Enable the service account IAM in Google Cloud Console](https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview)
- [Add role 'Service account token creator' to the Cloud Run service account](https://github.com/googleapis/nodejs-storage/issues/1222)

The strategy will use the projectId and credentials in from your environment, which is useful for Google Cloud Run or
Cloud Functions.

However, if you want to run it locally or on a custom environment, you need to pass a keyFile to the plugin. This is
needed to generate signedUrls, which are used to give customers temporary access to a file on Storage. More info about
locally using signedUrls: https://github.com/googleapis/nodejs-storage/issues/360

```ts
import {
  InvoicePlugin,
  GoogleStorageInvoiceStrategy,
} from 'vendure-plugin-invoices';

InvoicePlugin.init({
  vendureHost: 'http://localhost:3050',
  storageStrategy: new GoogleStorageInvoiceStrategy({
    bucketName: 'bucketname',
    storageOptions: {
      keyFilename: 'key.json',
    },
  }),
});
```

## Amazon S3 Storage strategy

This plugin also includes a strategy for storing invoices on Amazon S3.

`yarn add aws-sdk`

```ts
import { InvoicePlugin, S3StorageStrategy } from 'vendure-plugin-invoices';

InvoicePlugin.init({
  vendureHost: 'http://localhost:3050',
  storageStrategy: new S3StorageStrategy({
    expiresInSeconds: 360,
    /**
     * Config here will be passed directly to `new AWS.S3()`
     * See https://www.npmjs.com/package/aws-sdk for more info
     */
  }),
});
```

## Custom file storage

Implement your own strategy for storing invoices by implementing one of these interfaces:

#### Remote storage strategy

`RemoteStorageStrategy` for storing PDF files on an external platform like Google Cloud or S3. It redirects the user to
a public/authorized URL for the user to download the invoice PDF.

```ts
import { RemoteStorageStrategy, zipFiles } from 'vendure-plugin-invoices';

export class YourRemoteStrategy implements RemoteStorageStrategy {
  async save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string
  ): Promise<string> {
    // Save the invoice in your favorite cloud storage. The string you return will be saved as unique reference to your invoice.
    // You should be able to retrieve the file later with just the unique reference
    return 'unique-reference';
  }

  async getPublicUrl(invoice: InvoiceEntity): Promise<string> {
    // Most cloud based storages have the ability to generate a signed URL, which is available for X amount of time.
    // This way the downloading of invoices does not go through the vendure service
    return 'https://your-signed-url/invoice.pdf';
  }

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response
  ): Promise<ReadStream> {
    // zip files and return stream
    const zipped = zipFiles(files);
    return createReadStream(zipped);
  }
}
```

#### Local file storage

`LocalFileStrategy` streams the invoice through the Vendure service to the user.

```ts
import { LocalStorageStrategy, zipFiles } from 'vendure-plugin-invoices';

export class YourLocalStrategy implements LocalStorageStrategy {
  async save(tmpFile: string, invoiceNumber: number, channelToken: string) {
    // save the tmpFile somewhere
    return 'new/path.pdf';
  }

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response
  ): Promise<ReadStream> {
    // make a zip of your files
    const zipFile = await zipFiles(files);
    return createReadStream(zipFile);
  }

  async streamFile(invoice: InvoiceEntity, res: Response): Promise<ReadStream> {
    // stream a single PDF to the user
    return createReadStream(invoice.storageReference);
  }
}
```

## Custom invoice numbering and custom data

Implement the `DataStrategy` to pass custom data to your template or generate custom invoice numbers:

```ts
export class DefaultDataStrategy implements DataStrategy {
  async getData({
    ctx,
    injector,
    order,
    latestInvoiceNumber,
  }: DataFnInput): Promise<InvoiceData> {
    // Do something with the data
    return {
      invoiceNumber: String(Math.floor(Math.random() * 90000) + 10000),
      customerEmail: 'just used for admin display',
      order,
      someCustomField: '2022',
    };
  }
}
```

You can access this data in your HTML template using Handlebars.js:

```html
<h1>{{ someCustomField }}</h1>
```
