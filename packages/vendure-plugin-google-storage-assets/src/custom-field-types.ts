import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomAssetFields,
} from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomAssetFields {
    /**
     * Stringified JSON text of preset URLs
     * This field holds the URLs for each configured preset size/format of the asset
     */
    presets?: string;
  }
}
