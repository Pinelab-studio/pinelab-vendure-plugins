export {};

declare module '@vendure/core' {
  interface CustomAssetFields {
    /**
     * Stringified JSON text of preset URLs
     * This field holds the URLs for each configured preset size/format of the asset
     */
    presets?: string;
  }
}
