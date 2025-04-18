# Order PDF's Plugin

A Vendure plugin that enables the download of various types of PDF files for orders, such as quotations, packing slips, and shipping labels.

This plugin generates PDF's on the fly, and should **not be used for invoices**, because invoices should be persisted and have fixed numbers. Please check out our [Invoices Plugin](https://plugins.pinelab.studio/plugin/pinelab-invoice-plugin/) for compliant invoicing.

## Getting started

1. Add the following config to your `vendure-config.ts`:

```ts
import { OrderPDFsPlugin } from '@pinelab/vendure-plugin-order-pdfs';

plugins: [
    OrderPDFsPlugin.init({
        allowPublicDownload: true // This is optional
    }),
    // Add the plugin to your Admin UI extensions
    AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
        outputPath: path.join(__dirname, '__admin-ui'),
        extensions: [
            OrderPDFsPlugin.ui
        ],
    }),
    }),
],
```

2. Run a database migration to add the new entities to your database.
3. This plugin uses Puppeteer to generate PDF files. If you are running your app via a Docker image, see the [Docker](#docker) section below.
4. Start the server
5. Make sure you have the `AllowPDFDownload` permission, or that you are super admin.
6. Navigate to Settings > PDF Templates
7. Create a new template. A template is written in HTML and uses use Handlebars to insert variables into the PDF.
8. Go to a placed order, select the top right drop-down menu and select `Download PDF`

You can also download multiple PDF's in the order list. This is currently limited to 10 files, because PDF generation runs in the main instance, not the worker.

## Troubleshooting

### 403 Error Despite Proper Permissions

If you're encountering a `403 Forbidden` error in the Admin UI even after granting the correct permissions to your user (e.g., SuperAdmin), you may need to explicitly configure the token method used by the Admin UI to match your server configuration.

Add the following to your `AdminUiPlugin` configuration to ensure compatibility:

```ts
AdminUiPlugin.init({
  adminUiConfig: {
    tokenMethod: 'bearer', // ← switch from default 'cookie' to match server settings
    // The following are the defaults and should match your server config
    authTokenHeaderKey: 'vendure-auth-token',
    channelTokenKey: 'vendure-token',
  },
}),
```

This ensures that the Admin UI and the Vendure server are using the same token method (`bearer`), which is particularly important if your server is configured with both `"bearer"` and `"cookie"` token methods.

## Docker

To make Puppeteer work on Docker, you need some additional steps in your Dockerfile. This is the Dockerfile we use ourselves:

```Dockerfile
FROM node:18

# Set Puppeteer home dir
ENV PUPPETEER_CACHE_DIR=/usr/src/app/
# Install puppeteer dependencies as defined in https://github.com/puppeteer/puppeteer/blob/main/docker/Dockerfile
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] https://dl-ssl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser

# Create app directory
WORKDIR /usr/src/app

COPY . .
RUN npm install
RUN npm run build


# Run the web service on container startup.
CMD [ "npm", "run", "start" ]
```

## Publicly accessible PDF files

A customer can download a PDF file by accessing the url `/order-pdf/download/<CHANNEL_TOKEN>/<ORDER_CODE>/<TEMPLATE_ID>/<ORDER_EMAIL_ADDRESS>`. For example: `/order-pdf/download/my-channel-token/ORD1234XYZ/1/hayden.zieme12@hotmail.com`. This means a user should know the order code and the corresponding email address before she can download a PDF for the order. It's a plain GET request, so you can include these links, for example in emails you send to your customers.

You can query the available public templates via the shop api using the query below. You can then use the returned ID to construct the download URL.

```graphql
query {
  availablePDFTemplates {
    id
    createdAt
    updatedAt
    name
  }
}
```

If you want to disable this behavior, you can supply `allowPublicDownload: false` in the plugin init arguments.

## Custom data loading

If you need custom data, or more relations in your template, you can supply a custom data loading function. All data returned from this function is passed into your Handlebars HTML template.


```ts
import { LoadDataFn } from '@pinelab/vendure-plugin-order-pdfs';
import { Injector, Order, RequestContext} from '@vendure/core';


export const myCustomLoader: LoadDataFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order
): Promise<any> => {
  return {
    order,
    myCustomProp: injector.get(MyService).getSomeData()
  };
};

// Then, in your vendure-config
OrderPDFsPlugin.init({
    loadDataFn: myCustomLoader
}),
```

`myCustomProp` will now be available in all your templates.

## Increase HTML template DB storage

By default, the plugin uses TypeOrm's `text` to store the template in the DB. This might not be enough, for example when you'd like to add base64 encoded images to your picklists. This will result in the error `ER_DATA_TOO_LONG: Data too long for column 'templateString'`. You can specify your DB engine with an env variable, and the plugin will resolve the correct column type:

```shell
# E.g. For mysql the column type 'longtext' will be used, which supports up to 4gb
PDF_TEMPLATE_PLUGIN_DB_ENGINE=mysql
```
