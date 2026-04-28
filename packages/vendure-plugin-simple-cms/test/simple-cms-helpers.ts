import gql from 'graphql-tag';

/**
 * GraphQL introspection query used to retrieve a full schema description.
 * Used in tests to assert the dynamically generated CMS schema.
 */
export const INTROSPECTION_QUERY = gql`
  query IntrospectSchema {
    __schema {
      queryType {
        name
      }
      types {
        name
        kind
        interfaces {
          name
        }
        fields {
          name
          args {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface IntrospectionTypeRef {
  kind: string;
  name: string | null;
  ofType?: IntrospectionTypeRef | null;
}

export interface IntrospectionField {
  name: string;
  args: Array<{ name: string; type: IntrospectionTypeRef }>;
  type: IntrospectionTypeRef;
}

export interface IntrospectionType {
  name: string;
  kind: string;
  interfaces: Array<{ name: string }> | null;
  fields: IntrospectionField[] | null;
}

export interface IntrospectionSchema {
  queryType: { name: string };
  types: IntrospectionType[];
}

/**
 * Returns the type definition by name from the introspection result.
 */
export function getType(
  schema: IntrospectionSchema,
  name: string
): IntrospectionType | undefined {
  return schema.types.find((t) => t.name === name);
}

/**
 * Returns the field defined on the Query root type.
 */
export function getQueryField(
  schema: IntrospectionSchema,
  fieldName: string
): IntrospectionField | undefined {
  const queryType = getType(schema, schema.queryType.name);
  return queryType?.fields?.find((f) => f.name === fieldName);
}

/**
 * Returns a string representation of a type ref like `String!`, `[Banner!]!`.
 */
export function typeRefToString(ref: IntrospectionTypeRef): string {
  if (ref.kind === 'NON_NULL') {
    return `${typeRefToString(ref.ofType!)}!`;
  }
  if (ref.kind === 'LIST') {
    return `[${typeRefToString(ref.ofType!)}]`;
  }
  return ref.name ?? '';
}

/**
 * Returns the named field from a concrete object type.
 */
export function getField(
  type: IntrospectionType | undefined,
  name: string
): IntrospectionField | undefined {
  return type?.fields?.find((f) => f.name === name);
}

// ─── GraphQL document helpers ────────────────────────────────────────────────

export const CREATE_CONTENT_ENTRY = gql`
  mutation CreateContentEntry($input: ContentEntryInput!) {
    createContentEntry(input: $input) {
      id
      contentTypeCode
      fields
      translations {
        languageCode
        fields
      }
    }
  }
`;

export const DELETE_CONTENT_ENTRY = gql`
  mutation DeleteContentEntry($id: ID!) {
    deleteContentEntry(id: $id) {
      result
    }
  }
`;

export const CONTENT_ENTRIES_QUERY = gql`
  query ContentEntries($options: AdminContentEntryListOptions) {
    contentEntries(options: $options) {
      totalItems
      items {
        id
        contentTypeCode
        updatedAt
        displayName
      }
    }
  }
`;

export const GET_CONTENT_ENTRY = gql`
  query ContentEntry($id: ID!) {
    contentEntry(id: $id) {
      id
    }
  }
`;

export const GET_CONTENT_TYPES = gql`
  query {
    simpleCmsContentTypes {
      code
      displayName
      allowMultiple
      fields {
        name
        type
        nullable
        isTranslatable
        graphQLType
        ui
        fields {
          name
          type
          ui
        }
      }
    }
  }
`;

export const GET_FEATURED_PRODUCT = gql`
  query GetFeaturedProduct {
    featuredProduct {
      id
      title
      seo {
        metaTitle
        metaDescription
      }
      product {
        id
        name
        slug
        variants {
          id
          name
          sku
        }
      }
    }
  }
`;

export const GET_BANNERS = gql`
  query GetBanners {
    banners {
      id
      title
      priority
      product {
        id
        name
        slug
        variants {
          id
          name
          sku
        }
      }
    }
  }
`;

export const GET_BANNER_BY_ID = gql`
  query GetBanner($id: ID!) {
    banner(id: $id) {
      id
      title
      priority
    }
  }
`;
