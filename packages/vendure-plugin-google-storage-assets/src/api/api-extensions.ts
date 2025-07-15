import gql from 'graphql-tag';
import { GoogleStorageAssetConfig } from '../types';

/**
 * Extend the schema with the custom presets
 */
export function createAssetSchema(config: GoogleStorageAssetConfig) {
  // TODO dynamic schema extensions

  const baseSchema = gql`
    extend type Asset {
      thumbnail: String!
        @deprecated(reason: "Use custom presets. For example, Asset.presets")
    }

    extend type Mutation {
      generateGoogleStorageAssetPresets(force: Boolean): Boolean!
    }
  `;

  if (Object.entries(config.presets).length === 0) {
    return baseSchema;
  }

  // If presets in config, append schema with preset fields
  const presetSchema = gql`

    extend type Asset {
      presets: GoogleStorageAssetPresets!
    }

    type GoogleStorageAssetPresets {
      ${Object.keys(config.presets)
        .map((presetName) => `${presetName}: String`)
        .join('\n')}
    }
  `;

  return gql`
    ${baseSchema}

    ${presetSchema}
  `;
}
