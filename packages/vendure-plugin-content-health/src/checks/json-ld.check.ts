import { ContentCheckEntityType, ContentCheckMessage } from '../types';

export const PRODUCT_REQUIRED_TYPES = [
  'Product',
  'ProductGroup',
  'BreadcrumbList',
];
export const PRODUCT_ALTERNATIVE_TYPES = ['Organization', 'OnlineStore'];
export const COLLECTION_REQUIRED_TYPES = ['BreadcrumbList'];

/**
 * @description
 * Validates that the page's JSON-LD contains the required schema.org types.
 * Products require `Product`, `ProductGroup`, `BreadcrumbList`, and at least
 * one of `Organization`/`OnlineStore`. Collections require `BreadcrumbList`.
 * Each missing required type is a separate error message.
 */
export function checkJsonLdTypes(
  entityType: ContentCheckEntityType,
  foundTypes: string[]
): ContentCheckMessage[] {
  const messages: ContentCheckMessage[] = [];
  const found = new Set(foundTypes);

  const requiredTypes =
    entityType === 'product'
      ? PRODUCT_REQUIRED_TYPES
      : COLLECTION_REQUIRED_TYPES;

  for (const type of requiredTypes) {
    if (!found.has(type)) {
      messages.push({
        source: 'json-ld',
        severity: 'error',
        code: 'JSON_LD_MISSING_TYPE',
        message: `Required JSON-LD type '${type}' was not found on the page.`,
      });
    }
  }

  if (entityType === 'product') {
    const hasAlternative = PRODUCT_ALTERNATIVE_TYPES.some((t) => found.has(t));
    if (!hasAlternative) {
      messages.push({
        source: 'json-ld',
        severity: 'error',
        code: 'JSON_LD_MISSING_ORGANIZATION_OR_ONLINE_STORE',
        message: `Required JSON-LD type '${PRODUCT_ALTERNATIVE_TYPES.join(
          "' or '"
        )}' was not found on the page (at least one is required).`,
      });
    }
  }

  return messages;
}
