# Remote Asset Downloader

This util helps you download assets from a remote source to your local filesystem. We, at Pinelab, use it primarily to download transformed and optimized assets from Vendure and Directus for our static sites.

```ts
import { RemoteAssetDownloader } from '@pinelab/remote-asset-downloader';
const asssetDownloader = new RemoteAssetDownloader({
  publicAssetDirectory: './static/', // "static" is the folder where images should remain in Gridsome for example
  subDirectory: '/img/', // The subdirectory can be anything you want
  cacheDirectory: './node_modules/.cache', // The cache directory is used to store the downloaded assets. Netlify caches node_modules by default
  getRemoteUrl: (assetId) => `${directusUrl}/assets/${assetId}`,
  downloadRemoteAsset: true,
});

// This example creates two new properties on a project: "project.featured_image.small"
// and "project.featured_image.medium"
for (const project of projects) {
  const mediumImage = await asssetDownloader.getAsset(
    project.featured_image.id,
    {
      // Download the preset `medium-webp` which is configure in Directus
      fileName: `${project.title}_medium.webp`,
      transformationArguments: '?key=medium-webp',
    }
  );
  project.featured_image.medium = mediumImage;
  const smallImage = await asssetDownloader.getAsset(
    project.featured_image.id,
    {
      fileName: `${project.title}_small.webp`,
      transformationArguments: '?key=small-webp',
    }
  );
  project.featured_image.small = smallImage;
}
```

## AstroJS Example

For use with Astro JS, you would use `/public/` instead of `/static/`:

```ts
const asssetDownloader = new RemoteAssetDownloader({
  publicAssetDirectory: './public/',
  subDirectory: '/img/',
  cacheDirectory: './node_modules/.cache' // Astro should be caching this dir
  getRemoteUrl: (assetId) => `https://your-directus.io/assets/${assetId}`,
  // Or process.env.NODE_ENV === 'production' to only download in production
  downloadRemoteAsset: true,
});
```

With Astro, the copying of files from `public` to `dist` happens before the JS build, so you need to manually copy the downloaded files to dist after build: `npm run build && cp -r public/* dist/`
