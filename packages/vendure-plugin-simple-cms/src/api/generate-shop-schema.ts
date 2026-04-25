import {
  PrimitiveFieldDefinition,
  RelationFieldDefinition,
  SimpleCmsPluginOptions,
  StructFieldDefinition,
  TypeDefinition,
} from '../types';

/**
 * Regex matching valid GraphQL field/type identifier characters
 * (must start with a letter or underscore).
 */
const GRAPHQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Maps the primitive `type` to a GraphQL scalar.
 */
function primitiveToScalar(type: PrimitiveFieldDefinition['type']): string {
  switch (type) {
    case 'string':
    case 'text':
      return 'String';
    case 'int':
      return 'Int';
    case 'float':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'DateTime';
  }
}

/**
 * Converts an arbitrary string (e.g. a content type key or field name)
 * to a PascalCase GraphQL type name.
 */
export function toPascalCase(input: string): string {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/**
 * Returns the GraphQL type for a single field, including the trailing
 * `!` when the field is non-nullable.
 */
function fieldTypeSDL(
  field:
    | PrimitiveFieldDefinition
    | StructFieldDefinition
    | RelationFieldDefinition,
  parentTypeName: string
): string {
  const isNullable = field.nullable === true;
  let typeName: string;
  if (field.type === 'struct') {
    typeName = `${parentTypeName}${toPascalCase(field.name)}`;
  } else if (field.type === 'relation') {
    typeName = field.graphQLType;
  } else {
    typeName = primitiveToScalar(field.type);
  }
  return isNullable ? typeName : `${typeName}!`;
}

/**
 * Validates a key is a valid GraphQL identifier, throws otherwise.
 */
function assertValidIdentifier(value: string, label: string): void {
  if (!GRAPHQL_IDENTIFIER.test(value)) {
    throw new Error(
      `[SimpleCmsPlugin] Invalid ${label} '${value}': must match ${GRAPHQL_IDENTIFIER}`
    );
  }
}

/**
 * Generates the SDL for a struct's nested type.
 */
function generateStructType(
  parentTypeName: string,
  field: StructFieldDefinition
): string {
  const typeName = `${parentTypeName}${toPascalCase(field.name)}`;
  const lines = field.fields.map(
    (f) => `  ${f.name}: ${fieldTypeSDL(f, typeName)}`
  );
  return `type ${typeName} {\n${lines.join('\n')}\n}`;
}

/**
 * Generates the SDL for one content type, including nested struct types.
 */
function generateContentType(
  contentTypeKey: string,
  def: TypeDefinition
): { mainType: string; nestedTypes: string[] } {
  const typeName = toPascalCase(contentTypeKey);
  const nestedTypes: string[] = [];
  const fieldLines: string[] = [
    '  id: ID!',
    '  code: String!',
    '  createdAt: DateTime!',
    '  updatedAt: DateTime!',
  ];
  for (const field of def.fields) {
    assertValidIdentifier(field.name, `field name`);
    fieldLines.push(`  ${field.name}: ${fieldTypeSDL(field, typeName)}`);
    if (field.type === 'struct') {
      nestedTypes.push(generateStructType(typeName, field));
    }
  }
  const mainType = `type ${typeName} implements ContentEntry {\n${fieldLines.join(
    '\n'
  )}\n}`;
  return { mainType, nestedTypes };
}

/**
 * Generates the top-level Query field SDL for a content type.
 *
 * - `allowMultiple: true`  → list query + by-code query
 * - `allowMultiple: false` → singleton query (no args)
 */
function generateQueryFields(
  contentTypeKey: string,
  def: TypeDefinition
): string[] {
  const typeName = toPascalCase(contentTypeKey);
  if (def.allowMultiple) {
    const listName = `${contentTypeKey}s`;
    return [
      `  ${listName}: [${typeName}!]!`,
      `  ${contentTypeKey}(code: String!): ${typeName}`,
    ];
  }
  return [`  ${contentTypeKey}: ${typeName}`];
}

/**
 * Generates the full Shop API GraphQL SDL based on the configured
 * content types. Each content type becomes a concrete GraphQL type
 * implementing the `ContentEntry` interface. Struct fields become
 * dedicated nested types named `<Parent><PascalFieldName>`.
 */
export function generateShopSchema(options: SimpleCmsPluginOptions): string {
  const interfaceSDL = `interface ContentEntry {
  id: ID!
  code: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}`;
  const contentTypes = Object.entries(options.contentTypes ?? {});
  const objectTypes: string[] = [];
  const queryFields: string[] = [];
  for (const [key, def] of contentTypes) {
    assertValidIdentifier(key, 'content type key');
    const { mainType, nestedTypes } = generateContentType(key, def);
    objectTypes.push(mainType, ...nestedTypes);
    queryFields.push(...generateQueryFields(key, def));
  }
  const queryBlock = queryFields.length
    ? `extend type Query {\n${queryFields.join('\n')}\n}`
    : '';
  return [interfaceSDL, ...objectTypes, queryBlock]
    .filter(Boolean)
    .join('\n\n');
}
