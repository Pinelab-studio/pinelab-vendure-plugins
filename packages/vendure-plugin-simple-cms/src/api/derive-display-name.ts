import { LanguageCode } from '@vendure/core';
import { TypeDefinition } from '../types';
import { ContentEntry } from '../entities/content-entry.entity';

/**
 * Derives the human-readable display name for a content entry.
 *
 * Strategy:
 *  - Pick the first top-level field from the type definition where
 *    `type === 'string'` (declaration order).
 *  - If that field is translatable, look up the value from the
 *    translation matching the active language; if absent, fall back
 *    to the first available translation.
 *  - If the field is not translatable, read the value from the
 *    entry's JSON `fields` column.
 *  - Returns `null` when the content type defines no string field
 *    or the resolved value is empty/missing.
 *
 * @param entry - The content entry whose display name is being derived.
 * @param def - The content type definition for `entry.contentTypeCode`.
 * @param activeLanguage - The active request language code.
 */
export function deriveDisplayName(
  entry: ContentEntry,
  def: TypeDefinition | undefined,
  activeLanguage: LanguageCode
): string | null {
  if (!def) {
    return null;
  }
  const stringField = def.fields.find((f) => f.type === 'string');
  if (!stringField) {
    return null;
  }
  let value: unknown;
  if (stringField.type !== 'relation' && stringField.isTranslatable) {
    const translations = entry.translatableFields ?? [];
    const active = translations.find((t) => t.languageCode === activeLanguage);
    const fallback = translations[0];
    const chosen = active ?? fallback;
    value = chosen?.fields?.[stringField.name];
  } else {
    value = (entry.fields ?? {})[stringField.name];
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}
