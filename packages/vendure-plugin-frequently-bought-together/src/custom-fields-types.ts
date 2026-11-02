import { Product } from '@vendure/core';

declare module '@vendure/core' {
  interface CustomProductFields {
    frequentlyBoughtWith?: Product[];
    /**
     * Stringified JSON text of Support[]
     * This field holds the support level per product, so that we can return a sorted list of products based on their support level
     */
    frequentlyBoughtWithSupport?: string;
  }
}
