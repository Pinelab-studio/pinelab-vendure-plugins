import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { config } from './vendure-config';
import gql from 'graphql-tag';
import { VendureConfig } from '@vendure/core';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

const INTROSPECTION_QUERY = gql`
  query IntrospectSchema {
    __schema {
      types {
        name
        kind
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
        possibleTypes {
          name
        }
      }
    }
  }
`;

const CREATE_CONTENT_ENTRY = gql`
  mutation CreateContentEntry($input: ContentEntryInput!) {
    createContentEntry(input: $input) {
      ... on FeaturedProduct {
        id
        code
        name
        contentTypeCode
        subtitle
        title
        seo
        image {
          id
          preview
        }
        translations {
          id
          languageCode
          title
          seo
        }
        allowMultiple
        fieldDefinitions {
          name
          type
          nullable
          isTranslatable
          uiComponent
          fields {
            name
            type
          }
        }
      }
    }
  }
`;

const GET_CONTENT_ENTRIES = gql`
  query GetContentEntries {
    contentEntries {
      items {
        ... on FeaturedProduct {
          id
          code
          name
          contentTypeCode
          subtitle
          title
          seo
          image {
            id
          }
        }
      }
      totalItems
    }
  }
`;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__test__'));
  ({ server, adminClient, shopClient } = createTestEnvironment(
    config as Required<VendureConfig>
  ));
  await server.init({
    initialData: {
      ...initialData,
    },
    productsCsvPath: '../test/src/products-import.csv',
  });
  await adminClient.asSuperAdmin();
}, 60000);

afterAll(async () => {
  await server?.destroy();
}, 30000);

describe('SimpleCmsPlugin', () => {
  describe('GraphQL Schema Validation', () => {
    it('should generate FeaturedProduct type from contentTypes config', async () => {
      const { __schema } = await adminClient.query(INTROSPECTION_QUERY);
      const types: { name: string; kind: string; fields: any[] }[] =
        __schema.types;
      const featuredProduct = types.find(
        (t) => t.name === 'FeaturedProduct' && t.kind === 'OBJECT'
      );
      expect(featuredProduct).toBeDefined();
      const fieldNames = featuredProduct!.fields.map(
        (f: { name: string }) => f.name
      );
      // Base fields
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('code');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('contentTypeCode');
      expect(fieldNames).toContain('translations');
      // Custom fields from config
      expect(fieldNames).toContain('subtitle');
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('seo');
      expect(fieldNames).toContain('image');
      // Admin-only fields
      expect(fieldNames).toContain('allowMultiple');
      expect(fieldNames).toContain('fieldDefinitions');
    });

    it('should generate FeaturedProductTranslation type with translatable fields', async () => {
      const { __schema } = await adminClient.query(INTROSPECTION_QUERY);
      const types: { name: string; kind: string; fields: any[] }[] =
        __schema.types;
      const translation = types.find(
        (t) => t.name === 'FeaturedProductTranslation' && t.kind === 'OBJECT'
      );
      expect(translation).toBeDefined();
      const fieldNames = translation!.fields.map(
        (f: { name: string }) => f.name
      );
      expect(fieldNames).toContain('languageCode');
      // Translatable fields should appear in translation type
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('seo');
      // Non-translatable fields should NOT appear
      expect(fieldNames).not.toContain('subtitle');
      expect(fieldNames).not.toContain('image');
    });

    it('should generate ContentEntry union containing FeaturedProduct', async () => {
      const { __schema } = await adminClient.query(INTROSPECTION_QUERY);
      const types: { name: string; kind: string; possibleTypes?: any[] }[] =
        __schema.types;
      const union = types.find(
        (t) => t.name === 'ContentEntry' && t.kind === 'UNION'
      );
      expect(union).toBeDefined();
      expect(union!.possibleTypes).toBeDefined();
      const memberNames = union!.possibleTypes!.map(
        (t: { name: string }) => t.name
      );
      expect(memberNames).toContain('FeaturedProduct');
    });

    it('should have correct field types for FeaturedProduct', async () => {
      const { __schema } = await adminClient.query(INTROSPECTION_QUERY);
      const types: { name: string; kind: string; fields: any[] }[] =
        __schema.types;
      const featuredProduct = types.find((t) => t.name === 'FeaturedProduct')!;
      const subtitleField = featuredProduct.fields.find(
        (f: any) => f.name === 'subtitle'
      );
      expect(subtitleField.type.name).toBe('String');
      const seoField = featuredProduct.fields.find(
        (f: any) => f.name === 'seo'
      );
      expect(seoField.type.name).toBe('JSON');
      const imageField = featuredProduct.fields.find(
        (f: any) => f.name === 'image'
      );
      expect(imageField.type.name).toBe('Asset');
    });

    it('should expose contentEntries query on shop API', async () => {
      const { __schema } = await shopClient.query(INTROSPECTION_QUERY);
      const queryType = (__schema.types as any[]).find(
        (t) => t.name === 'Query'
      );
      const fieldNames = queryType.fields.map((f: any) => f.name);
      expect(fieldNames).toContain('contentEntries');
      expect(fieldNames).toContain('contentEntry');
    });

    it('should expose admin mutations', async () => {
      const { __schema } = await adminClient.query(INTROSPECTION_QUERY);
      const mutationType = (__schema.types as any[]).find(
        (t) => t.name === 'Mutation'
      );
      const fieldNames = mutationType.fields.map((f: any) => f.name);
      expect(fieldNames).toContain('createContentEntry');
      expect(fieldNames).toContain('updateContentEntry');
      expect(fieldNames).toContain('deleteContentEntry');
    });
  });

  describe('CRUD Operations', () => {
    let createdEntryId: string;

    it('should create a content entry', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            code: 'homepage',
            name: 'Homepage',
            contentTypeCode: 'featuredProduct',
            fields: {
              subtitle: 'The best products',
            },
            translations: [
              {
                languageCode: 'en',
                fields: {
                  title: 'Welcome to Simple CMS',
                  seo: {
                    metaTitle: 'Home | My Shop',
                    metaDescription: 'Browse our featured products',
                  },
                },
              },
            ],
          },
        }
      );
      expect(createContentEntry.code).toBe('homepage');
      expect(createContentEntry.name).toBe('Homepage');
      expect(createContentEntry.contentTypeCode).toBe('featuredProduct');
      expect(createContentEntry.subtitle).toBe('The best products');
      expect(createContentEntry.title).toBe('Welcome to Simple CMS');
      expect(createContentEntry.seo).toEqual({
        metaTitle: 'Home | My Shop',
        metaDescription: 'Browse our featured products',
      });
      expect(createContentEntry.allowMultiple).toBe(false);
      expect(createContentEntry.fieldDefinitions).toHaveLength(4);
      createdEntryId = createContentEntry.id;
    });

    it('should list content entries', async () => {
      const { contentEntries } = await adminClient.query(GET_CONTENT_ENTRIES);
      expect(contentEntries.totalItems).toBe(1);
      expect(contentEntries.items[0].code).toBe('homepage');
      expect(contentEntries.items[0].subtitle).toBe('The best products');
    });

    it('should query content entries from shop API', async () => {
      const SHOP_QUERY = gql`
        query {
          contentEntries {
            items {
              ... on FeaturedProduct {
                id
                code
                subtitle
                title
              }
            }
            totalItems
          }
        }
      `;
      const { contentEntries } = await shopClient.query(SHOP_QUERY);
      expect(contentEntries.totalItems).toBe(1);
      expect(contentEntries.items[0].code).toBe('homepage');
    });
  });
});
