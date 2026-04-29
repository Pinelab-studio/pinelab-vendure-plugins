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
   * Whether the field is nullable. Default is false (i.e. required).
   */
  nullable?: boolean;
}

/**
 * UI configuration consumed by the React Dashboard to render the
 * appropriate form input for a field. The `component` key identifies
 * the form input component; any additional keys are arbitrary props
 * passed through to that component.
 */
export interface UiConfig {
  component: string;
  [key: string]: unknown;
}

/**
 * The set of primitive scalar types supported for fields and struct sub-fields.
 */
export type PrimitiveType =
  | 'string'
  | 'text'
  | 'int'
  | 'float'
  | 'boolean'
  | 'date';

/**
 * The field definition for a primitive field.
 * A primitive field is a field that is a single value.
 * Example: `string`, `number`, `boolean`, `date`
 */
export interface PrimitiveFieldDefinition extends Translatable, BaseField {
  type: PrimitiveType;
  ui?: UiConfig;
}

/**
 * The field definition for a sub-field of a struct.
 * Sub-fields are NOT individually translatable: a struct as a whole
 * is either translatable or not (driven by the parent struct's
 * `isTranslatable` flag). This mirrors Vendure's native
 * struct custom field behaviour.
 */
export interface StructSubFieldDefinition extends BaseField {
  type: PrimitiveType;
  ui?: UiConfig;
}

/**
 * The field definition for a struct field.
 * A struct field is a field that contains other fields.
 * Example: `{key: string, value: string}`
 *
 * The whole struct is either translatable or not via `isTranslatable`.
 * Individual sub-fields cannot opt in or out of translation.
 */
export interface StructFieldDefinition extends Translatable, BaseField {
  type: 'struct';
  fields: StructSubFieldDefinition[];
}

/**
 * The field definition for a relational field like Asset, Customer, Product, etc.
 */
export interface RelationFieldDefinition extends BaseField {
  type: 'relation';
  entity: Type<VendureEntity>;
  graphQLType: string;
  eager?: boolean;
  ui?: UiConfig;
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
