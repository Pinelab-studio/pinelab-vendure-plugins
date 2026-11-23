/**
 * `entityType` is 'PRODUCT'/'COLLECTION' for the built-in types, or
 * whatever free-form string an `additionalChecks` function chose for a
 * custom entity (e.g. 'cms-content-entry'). Show a friendly label for the
 * two built-ins; anything else is shown as-is, since it's already a label
 * the site owner chose.
 */
export function entityTypeLabel(entityType: string): string {
  if (entityType === 'PRODUCT') {
    return 'Product';
  }
  if (entityType === 'COLLECTION') {
    return 'Collection';
  }
  return entityType;
}

export function isCoreEntityType(entityType: string): boolean {
  return entityType === 'PRODUCT' || entityType === 'COLLECTION';
}
