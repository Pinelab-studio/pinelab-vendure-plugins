// Note: we are using deep a import here, rather than importing from `@vendure/core` due to
// a possible bug in TypeScript (https://github.com/microsoft/TypeScript/issues/46617) which
// causes issues when multiple plugins extend the same custom fields interface.
import { CustomOrderLineFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomOrderLineFields {
    subscriptionIds?: string[];
    /**
     * Unique hash to separate order lines
     */
    subscriptionHash?: string;
  }
}
