import { StorageOptions } from '@google-cloud/storage';
import type { Sharp } from 'sharp';

export interface AssetPreset {
  /**
   * Extension without the dot.
   *
   * @example 'webp'
   */
  extension: string;
  /**
   * Function that generates the preset.
   *
   * @param sharp - Sharp instance
   * @returns Buffer
   */
  generateFn: GeneratePresetFn;
}

export type GeneratePresetFn = (sharp: Sharp) => Promise<Buffer>;

export interface GoogleStorageAssetConfig {
  bucketName: string;
  /**
   * Presets that will be generated after upload.
   * These presets are available via graphql on `Asset.presets.<presetName>` and point directly to the Google Storage URL.
   *
   * See https://sharp.pixelplumbing.com/api-output#toformat for more information on the options.
   *
   * @example
   *   presets: {
   *     thumbnail: {
   *       extension: 'webp',
   *       generateFn: (sharp) => sharp.resize(500).toFormat('webp').toBuffer(),
   *     },
   *   },
   */
  presets: Record<string, AssetPreset>;
  storageOptions?: StorageOptions;
  /**
   * Proxy images through the asset-server for admin UI, so that images are resized for admin UI.
   */
  useAssetServerForAdminUi?: boolean;
}
