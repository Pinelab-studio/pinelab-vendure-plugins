# Vendure Google Asset Storage plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-google-storage-assets)

Plugin for storing Vendure assets on Google Cloud Storage with support for pre-generated image presets.

## Getting started

1. Create a bucket which is publicly available in Google Cloud.
2. Add this to your `vendure-config.ts`:

```ts
import {
  GoogleStoragePlugin,
  GoogleStorageStrategy,
} from '@pinelab/vendure-plugin-google-storage-assets';

plugins: [
  AssetServerPlugin.init({
    storageStrategyFactory: () => new GoogleStorageStrategy(),
    route: 'assets',
    assetUploadDir: '/tmp/vendure/assets',
  }),
  GoogleStoragePlugin.init({
    bucketName: 'your-bucket-name',
    presets: {
      // 500px wide webp thumbnail
      thumbnail: {
        extension: 'webp',
        generateFn: (sharp) =>
          sharp
            .resize(500)
            .toFormat('webp', { quality: 80, smartSubsample: true })
            .toBuffer(),
      },
      // 1500px wide webp preview
      webpPreview: {
        extension: 'webp',
        generateFn: (sharp) => sharp.resize(1500).toFormat('webp').toBuffer(),
      },
    },
  }),
];
```

3. Run a database migration to add the `presets` custom field to the `Asset` entity.

## Image Presets

Presets allow you to pre-generate different versions of uploaded images. These versions are stored directly in your Google Cloud Storage bucket. This means you can get direct URLs to these pre-generated images without having to go through the Vendure asset server.

When an asset is uploaded, all configured presets are automatically generated. Each preset generates a new file in your bucket.

### Fetching Preset URLs

You can fetch preset URLs through the Shop API using this query:

```graphql
query {
  product(id: "1") {
    featuredAsset {
      id
      name
      presets {
        # these presets are defined in the plugin config above
        thumbnail
        webpPreview
      }
    }
  }
}
```

:warning: Whenever you change the presets, or set presets for the first time,you need to re-generate the presets for all assets. This can be done by running the `generateGoogleStorageAssetPresets` mutation.

### Generating Presets for Existing Assets

To generate presets for all existing assets, you can use the Admin API. You will need to have Asset Update permission to run this mutation.

```graphql
# This will generate presets for assets that don't have any presets yet
mutation {
  generateGoogleStorageAssetPresets
}

# Or, if you want to force re-generation of all presets
mutation {
  generateGoogleStorageAssetPresets(force: true)
}
```

### Running locally

Using this plugin on your local machine requires you to be logged in to Google Cloud, so that the plugin can upload assets to your bucket.

1. Run `gcloud auth application-default login`
2. Create a .env file with the following contents:

```env
GCLOUD_PROJECT=your-project-id
BUCKET=your-bucket
```

3. Run `yarn start` and go to https://localhost:3050/admin to test asset uploads

### Google Cloud Storage Authentication

Internally this plugin uses `new Storage();` to instantiate the Storage client, which uses ENV variables to authenticate:

```
// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GCLOUD_PROJECT environment variable. See
// https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application
```

For more information about Google Cloud authentication, see: https://cloud.google.com/compute/docs/tutorials/nodejs-guide
