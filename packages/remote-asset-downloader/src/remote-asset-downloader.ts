import fs from 'fs';
import fetch from 'node-fetch';

interface DownloadConfig {
  /**
   * Local file path to a directory.
   * This is where the assets will be stored.
   * This downloader assumes the path after the publicAssetDirectory is publicly available for the storefront.
   *
   * E.g. when assets are saved in ./static/asset123.webp, `/asset123.webp` will be the public url
   */
  publicAssetDirectory: string;
  /**
   * Specify a cache directory to store the downloaded assets.
   * E.g. Netlify caches the `.cache` directory between builds
   */
  cacheDirectory: string;
  /**
   * Provide a subdirectory for the assets. This directory should be excluded from git,
   * and added to your build cache. (For example, the Netlify Build Cache)
   */
  subDirectory: string;
  /**
   * This function should return the remote URL of the asset.
   * E.g. (assetId) => `https://my-cms.io/assets/${assetId}?format=webp`
   */
  getRemoteUrl: (assetId: string) => string;
  /**
   * If false, will resolve the remote URL.
   * This can be useful during development, where you don't want to download the assets.
   *
   * Default is true.
   */
  downloadRemoteAsset?: boolean;
}

interface AssetOptions {
  /**
   * The filename including the extension of the asset.
   *
   * Make sure this name is unique for each asset.
   * So, if you generate multiple sizes of the same asset,
   * include the size in the filename, e.g. `asset123_small.webp`
   *
   * For better SEO it makes sense to give your asset a sensible name.
   * This is the filename that will also be used by your storefront.
   */
  fileName: string;
  /**
   * Optional suffix to append to the remote URL for transformations or transformation presets
   * E.g. `?w=85&h=85&mode=crop&format=webp` or `?preset=thumbnail`
   */
  transformationArguments?: string;
}

/**
 * Downloads remote assets and resolves the URL of the asset for storefront usage
 */
export class RemoteAssetDownloader {
  constructor(private readonly config: DownloadConfig) {
    config.publicAssetDirectory = this.stripTrailingAndLeadingSlash(
      config.publicAssetDirectory
    );
    config.subDirectory = this.stripTrailingAndLeadingSlash(
      config.subDirectory
    );
    config.cacheDirectory = this.stripTrailingAndLeadingSlash(
      config.cacheDirectory
    );
  }

  /**
   * Resolve the url of an asset so that it can be used in a storefront
   * This will be a remote URL if `downloadRemoteAsset=true`
   *
   */
  async getAsset(
    assetId: string,
    { fileName, transformationArguments }: AssetOptions
  ): Promise<string> {
    let remoteUrl = this.config.getRemoteUrl(assetId);
    if (transformationArguments) {
      remoteUrl += `${transformationArguments}`;
    }
    if (this.config.downloadRemoteAsset === false) {
      // Return the remote URL if configured to do so.
      return remoteUrl;
    }
    const assetDir = `${this.config.publicAssetDirectory}/${this.config.subDirectory}`;
    const downloadedFileName = this.stripUnsafeCharacters(
      `${assetId}_${fileName}`
    );
    const destinationPath = `${assetDir}/${downloadedFileName}`;
    // Construct the public storefront path, e.g. "/subdirectory/asset123.webp"
    const storefrontUrl = destinationPath.replace(
      this.config.publicAssetDirectory,
      ''
    );
    const cachedAsset = `${this.config.cacheDirectory}/${downloadedFileName}`;
    fs.mkdirSync(this.config.cacheDirectory, { recursive: true });
    try {
      // Check if we have a cached asset
      fs.accessSync(cachedAsset);
      // Copy file from cache to target location
      fs.copyFileSync(cachedAsset, destinationPath);
      console.log(`Using cached asset from ${cachedAsset}`);
      return storefrontUrl;
    } catch (e) {
      // File doesn't exist
    }
    console.log(
      `No cached asset found in ${cachedAsset}, downloading asset ${remoteUrl}`
    );
    fs.mkdirSync(assetDir, { recursive: true });
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to download asset from ${remoteUrl}`);
    }
    const assetData = await response.arrayBuffer();
    fs.writeFileSync(destinationPath, Buffer.from(assetData));
    // Also copy back into cache
    fs.copyFileSync(destinationPath, cachedAsset);
    return storefrontUrl;
  }

  /**
   * Replace any characters that are not safe to use in a file name
   * E.g. `This test@22.wepb` -> `this_test_22.webp`
   */
  private stripUnsafeCharacters(str: string): string {
    return str.toLocaleLowerCase().replace(/[^a-zA-Z0-9-_.]/g, '_');
  }

  private stripTrailingAndLeadingSlash(str: string): string {
    const newStr = str.startsWith('/') ? str.slice(1) : str;
    return newStr.endsWith('/') ? newStr.slice(0, -1) : newStr;
  }
}
