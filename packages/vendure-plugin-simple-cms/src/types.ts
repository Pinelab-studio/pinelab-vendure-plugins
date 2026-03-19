import { Type, VendureEntity } from '@vendure/core';

interface Translatable {
  /**
   * Whether the field is translatable. If true, different values can be used per language.
   * Example: title, description, etc.
   */
  isTranslatable: boolean;
}

interface BaseField {
  name: string;
  /**
   * Whether the field is nullable. Default is true.
   */
  nullable?: boolean;
}

/**
 * The field definition for a primitive field.
 * A primitive field is a field that is a single value.
 * Example: `string`, `number`, `boolean`, `date`
 */
export interface PrimitiveFieldDefinition extends Translatable, BaseField {
  type: 'string' | 'text' | 'number' | 'boolean' | 'date';
  uiComponent?: string;
}

/**
 * The field definition for a struct field.
 * A struct field is a field that contains other fields.
 * Example: `{key: string, value: string}`
 */
export interface StructFieldDefinition extends Translatable, BaseField {
  type: 'struct';
  fields: PrimitiveFieldDefinition[];
}

/**
 * The field definition for a relational field like Asset, Customer, Product, etc.
 */
export interface RelationFieldDefinition extends BaseField {
  type: 'relation';
  entity: Type<VendureEntity>;
  graphQLType: string;
  eager?: boolean;
  uiComponent?: string;
}

export interface TypeDefinition {
  displayName: string;
  allowMultiple: boolean;
  fields: (
    | PrimitiveFieldDefinition
    | StructFieldDefinition
    | RelationFieldDefinition
  )[];
}

export interface SimpleCmsPluginOptions {
  contentTypes: Record<string, TypeDefinition>;
}
