import { UserInputError } from '@vendure/core';
import {
  PrimitiveFieldDefinition,
  StructFieldDefinition,
  RelationFieldDefinition,
  TypeDefinition,
} from '../types';
import {
  ContentEntryInput,
  ContentEntryTranslationInput,
} from '../api/generated/graphql';

const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

type AnyFieldDefinition =
  | PrimitiveFieldDefinition
  | StructFieldDefinition
  | RelationFieldDefinition;

/**
 * Validates an admin `ContentEntryInput` against the configured
 * `TypeDefinition`. Throws `UserInputError` on the first violation.
 *
 * Performed checks:
 *  - `code` matches `[A-Za-z_][A-Za-z0-9_]*`.
 *  - `input.fields` only contains keys for non-translatable fields and
 *    relation fields; no unknown keys allowed.
 *  - Required (non-nullable) non-translatable fields are present.
 *  - Each value matches its declared type (string/text/int/float/boolean
 *    /date/struct/relation).
 *  - Translatable fields appear only in `input.translations[].fields`,
 *    every translation row has a unique `languageCode`, no unknown keys,
 *    and required translatable fields are present per row.
 */
export function validateContentEntryInput(
  contentType: TypeDefinition,
  input: ContentEntryInput
): void {
  if (!KEY_REGEX.test(input.code)) {
    throw new UserInputError(
      `Invalid code '${input.code}': must match /^[A-Za-z_][A-Za-z0-9_]*$/`
    );
  }

  const translatableFields = contentType.fields.filter(
    (f): f is PrimitiveFieldDefinition | StructFieldDefinition =>
      f.type !== 'relation' && f.isTranslatable === true
  );
  const nonTranslatableFields = contentType.fields.filter(
    (f) => !translatableFields.includes(f as never)
  ) as AnyFieldDefinition[];

  validateTopLevelFields(nonTranslatableFields, translatableFields, input);
  validateTranslations(translatableFields, input.translations ?? null);
}

function validateTopLevelFields(
  nonTranslatable: AnyFieldDefinition[],
  translatable: Array<PrimitiveFieldDefinition | StructFieldDefinition>,
  input: ContentEntryInput
): void {
  const fields = (input.fields ?? {}) as Record<string, unknown>;
  const allowedNames = new Set(nonTranslatable.map((f) => f.name));

  for (const key of Object.keys(fields)) {
    if (translatable.some((f) => f.name === key)) {
      throw new UserInputError(
        `Field '${key}' is translatable and must be provided in 'translations', not in 'fields'`
      );
    }
    if (!allowedNames.has(key)) {
      throw new UserInputError(
        `Unknown field '${key}' for content type '${input.contentTypeCode}'`
      );
    }
  }

  for (const fieldDef of nonTranslatable) {
    const present = fieldDef.name in fields;
    const value = fields[fieldDef.name];
    const isNullable = fieldDef.nullable === true;
    if (!present || value === null || value === undefined) {
      if (!isNullable) {
        throw new UserInputError(
          `Required field '${fieldDef.name}' is missing`
        );
      }
      continue;
    }
    assertValueMatchesType(fieldDef, value);
  }
}

function validateTranslations(
  translatable: Array<PrimitiveFieldDefinition | StructFieldDefinition>,
  translations: ContentEntryTranslationInput[] | null
): void {
  if (!translations || translations.length === 0) {
    // If there are required translatable fields but no translations row at all,
    // we still expect at least one row. Otherwise required-field check below
    // would never fire.
    const hasRequired = translatable.some((f) => f.nullable === false);
    if (hasRequired) {
      throw new UserInputError(
        `At least one translation is required for translatable fields`
      );
    }
    return;
  }

  const seenLanguages = new Set<string>();
  const allowedNames = new Set(translatable.map((f) => f.name));

  for (const t of translations) {
    const lang = String(t.languageCode);
    if (seenLanguages.has(lang)) {
      throw new UserInputError(`Duplicate translation languageCode '${lang}'`);
    }
    seenLanguages.add(lang);

    const tFields = (t.fields ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(tFields)) {
      if (!allowedNames.has(key)) {
        throw new UserInputError(
          `Unknown translatable field '${key}' in translation '${lang}'`
        );
      }
    }
    for (const fieldDef of translatable) {
      const present = fieldDef.name in tFields;
      const value = tFields[fieldDef.name];
      const isNullable = fieldDef.nullable === true;
      if (!present || value === null || value === undefined) {
        if (!isNullable) {
          throw new UserInputError(
            `Required translatable field '${fieldDef.name}' is missing for languageCode '${lang}'`
          );
        }
        continue;
      }
      assertValueMatchesType(fieldDef, value);
    }
  }
}

function assertValueMatchesType(
  fieldDef: AnyFieldDefinition,
  value: unknown
): void {
  switch (fieldDef.type) {
    case 'string':
    case 'text':
      if (typeof value !== 'string') {
        throw new UserInputError(
          `Field '${fieldDef.name}' must be a string, got ${typeof value}`
        );
      }
      return;
    case 'int':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new UserInputError(`Field '${fieldDef.name}' must be an integer`);
      }
      return;
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new UserInputError(
          `Field '${fieldDef.name}' must be a finite number`
        );
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new UserInputError(`Field '${fieldDef.name}' must be a boolean`);
      }
      return;
    case 'date':
      if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) {
        throw new UserInputError(
          `Field '${fieldDef.name}' must be an ISO 8601 date string`
        );
      }
      return;
    case 'struct':
      assertStructValue(fieldDef, value);
      return;
    case 'relation':
      assertRelationValue(fieldDef, value);
      return;
    default: {
      const _exhaustive: never = fieldDef;
      void _exhaustive;
    }
  }
}

function assertStructValue(
  fieldDef: StructFieldDefinition,
  value: unknown
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UserInputError(`Field '${fieldDef.name}' must be an object`);
  }
  const obj = value as Record<string, unknown>;
  const allowed = new Set(fieldDef.fields.map((f) => f.name));
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new UserInputError(
        `Unknown sub-field '${key}' on struct '${fieldDef.name}'`
      );
    }
  }
  for (const sub of fieldDef.fields) {
    const present = sub.name in obj;
    const subValue = obj[sub.name];
    const isNullable = sub.nullable === true;
    if (!present || subValue === null || subValue === undefined) {
      if (!isNullable) {
        throw new UserInputError(
          `Required sub-field '${sub.name}' is missing on struct '${fieldDef.name}'`
        );
      }
      continue;
    }
    assertValueMatchesType(sub, subValue);
  }
}

function assertRelationValue(
  fieldDef: RelationFieldDefinition,
  value: unknown
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UserInputError(
      `Relation field '${fieldDef.name}' must be an object with an 'id' property`
    );
  }
  const id = (value as Record<string, unknown>).id;
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new UserInputError(
      `Relation field '${fieldDef.name}' must have a string or number 'id'`
    );
  }
}
