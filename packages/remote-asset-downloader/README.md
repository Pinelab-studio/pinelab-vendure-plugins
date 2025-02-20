# Remote Asset Downloader

This util helps you download assets from a remote source to your local filesystem. We, at Pinelab, use it primarily to download transformed and optimized assets from Vendure and Directus for our static sites.

```ts
import { RemoteAssetDownloader } from '@pinelab/remote-asset-downloader';
const asssetDownloader = new RemoteAssetDownloader({
  publicAssetDirectory: './static/',
  subDirectory: '/remote-img/',
  getRemoteUrl: (assetId) =>
    // This can be any asset server, as long as it returns an asset
    `https://your-directus.io/assets/${assetId}`,
  // Or process.env.NODE_ENV === 'production' to only download in production
  downloadRemoteAsset: true,
});

// This example creates two new properties on a project: "project.featured_image.small"
// and "project.featured_image.medium"
for (project of projects) {
  const mediumImage = await asssetDownloader.getAsset(
    project.featured_image.id,
    {
      // Download the preset `medium-webp` which is configure in Directus
      fileName: `${project.title}_medium.webp`,
      transformations: '?key=medium-webp',
    }
  );
  project.featured_image.medium = mediumImage;
  const smallImage = await asssetDownloader.getAsset(
    project.featured_image.id,
    {
      fileName: `${project.title}_small.webp`,
      transformations: '?key=small-webp',
    }
  );
  project.featured_image.small = smallImage;
}
```

In the example above, you should exclude the subdirectory `/remote-img/` from git. You might also want to [add that same directory to the Netlify Build cache](https://www.npmjs.com/package/@netlify/cache-utils), so that assets won't be downloaded again for each build.

## AstroJS Example

For use with Astro JS, you would use `/public/` instead of `/static/`:

```ts
const asssetDownloader = new RemoteAssetDownloader({
  publicAssetDirectory: './public/',
  subDirectory: '/remote-img/',
  getRemoteUrl: (assetId) => `https://your-directus.io/assets/${assetId}`,
  // Or process.env.NODE_ENV === 'production' to only download in production
  downloadRemoteAsset: true,
});
```
