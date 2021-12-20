# Vendure Google Asset Storage plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-google-storage-assets/dev/@vendure/core)

Google Cloud Storage strategy for Vendure ecommerce.  
Stores assets in a Google Cloud Storage Bucket.
In the Shop-api it returns the absolute public url to the storage bucket, thus not going through the asset server. I.E. `https://storage.googleapis.com/yourbucket/image.jpg`

In the admin api, it returns the relative url, because the Admin UI needs resizing functionality of the asset server.

## Installation

1. `yarn add vendure-plugin-google-storage-assets`
1. Create a bucket which is publicly available in Google Cloud.
1. Add to your `sendcloud.dev-config.ts`

```js
        AssetServerPlugin.init({
            storageStrategyFactory: () => new GoogleStorageStrategy({
                bucketname: 'your-bucket-name',
                thumbnails: {
                    width: 400,
                    height: 400,
                }
            }),
            route: 'assets',
            assetUploadDir: '/tmp/vendure/assets',
            port: 3001,
        }),
        GoogleStoragePlugin, // Append asset.thumbnail to shop-api and admin-api
```

## Local development

For local development, use `gcloud auth application-default login` to authorize for your Gcloud project.  
Internally this plugin uses `new Storage();` to instantiate the Storage client, which uses ENV variables to authenticate:

```
// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GCLOUD_PROJECT environment variable. See
// https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application
```

https://cloud.google.com/compute/docs/tutorials/nodejs-guide

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
