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
import { VendureConfig } from '@vendure/core';
import gql from 'graphql-tag';
import {
  getField,
  getQueryField,
  getType,
  INTROSPECTION_QUERY,
  IntrospectionSchema,
  typeRefToString,
} from './simple-cms-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

let shopSchema: IntrospectionSchema;
let adminSchema: IntrospectionSchema;

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
  const shopResult = await shopClient.query(INTROSPECTION_QUERY);
  shopSchema = shopResult.__schema;
  const adminResult = await adminClient.query(INTROSPECTION_QUERY);
  adminSchema = adminResult.__schema;
}, 60000);

afterAll(async () => {
  await server?.destroy();
}, 30000);

describe('SimpleCmsPlugin', () => {
  describe('GraphQL Schema Generation', () => {
    it('Generates the ContentEntry interface on the shop API', () => {
      const iface = getType(shopSchema, 'ContentEntry');
      expect(iface).toBeDefined();
      expect(iface!.kind).toBe('INTERFACE');
      expect(typeRefToString(getField(iface, 'id')!.type)).toBe('ID!');
      expect(typeRefToString(getField(iface, 'code')!.type)).toBe('String!');
      expect(typeRefToString(getField(iface, 'createdAt')!.type)).toBe(
        'DateTime!'
      );
      expect(typeRefToString(getField(iface, 'updatedAt')!.type)).toBe(
        'DateTime!'
      );
    });

    it('Generates the FeaturedProduct singleton type and query', () => {
      const type = getType(shopSchema, 'FeaturedProduct');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('OBJECT');
      expect(type!.interfaces?.map((i) => i.name)).toContain('ContentEntry');

      // Fields with correct nullability
      expect(typeRefToString(getField(type, 'subtitle')!.type)).toBe('String');
      expect(typeRefToString(getField(type, 'title')!.type)).toBe('String!');
      expect(typeRefToString(getField(type, 'seo')!.type)).toBe(
        'FeaturedProductSeo!'
      );
      expect(typeRefToString(getField(type, 'image')!.type)).toBe('Asset!');

      // Nested struct type
      const seoType = getType(shopSchema, 'FeaturedProductSeo');
      expect(seoType).toBeDefined();
      expect(typeRefToString(getField(seoType, 'metaTitle')!.type)).toBe(
        'String!'
      );
      expect(typeRefToString(getField(seoType, 'metaDescription')!.type)).toBe(
        'String!'
      );

      // Singleton query: no args, no list, no by-code variants
      const singleton = getQueryField(shopSchema, 'featuredProduct');
      expect(singleton).toBeDefined();
      expect(singleton!.args).toHaveLength(0);
      expect(typeRefToString(singleton!.type)).toBe('FeaturedProduct');
      expect(getQueryField(shopSchema, 'featuredProducts')).toBeUndefined();
    });

    it('Generates the Banner non-singleton type and queries', () => {
      const type = getType(shopSchema, 'Banner');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('OBJECT');
      expect(type!.interfaces?.map((i) => i.name)).toContain('ContentEntry');

      expect(typeRefToString(getField(type, 'title')!.type)).toBe('String!');
      expect(typeRefToString(getField(type, 'priority')!.type)).toBe('Int');
      expect(typeRefToString(getField(type, 'image')!.type)).toBe('Asset!');

      // List query: no args, returns [Banner!]!
      const list = getQueryField(shopSchema, 'banners');
      expect(list).toBeDefined();
      expect(list!.args).toHaveLength(0);
      expect(typeRefToString(list!.type)).toBe('[Banner!]!');

      // By-code query: required `code: String!`, returns Banner (nullable)
      const byCode = getQueryField(shopSchema, 'banner');
      expect(byCode).toBeDefined();
      expect(byCode!.args).toHaveLength(1);
      expect(byCode!.args[0].name).toBe('code');
      expect(typeRefToString(byCode!.args[0].type)).toBe('String!');
      expect(typeRefToString(byCode!.type)).toBe('Banner');
    });

    it('Generates the AdminContentEntry type with JSON fields on the admin API', () => {
      const type = getType(adminSchema, 'AdminContentEntry');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('OBJECT');
      expect(typeRefToString(getField(type, 'id')!.type)).toBe('ID!');
      expect(typeRefToString(getField(type, 'code')!.type)).toBe('String!');
      expect(typeRefToString(getField(type, 'fields')!.type)).toBe('JSON!');
    });
  });

  describe('createContentEntry admin mutation + shop API fetches', () => {
    const CREATE_CONTENT_ENTRY = gql`
      mutation CreateContentEntry($input: ContentEntryInput!) {
        createContentEntry(input: $input) {
          id
          code
          name
          contentTypeCode
          fields
          translations {
            languageCode
            fields
          }
        }
      }
    `;

    const GET_FEATURED_PRODUCT = gql`
      query GetFeaturedProduct {
        featuredProduct {
          id
          code
          title
          subtitle
          seo {
            metaTitle
            metaDescription
          }
          image {
            id
          }
        }
      }
    `;

    const GET_BANNERS = gql`
      query GetBanners {
        banners {
          id
          code
          title
          priority
          image {
            id
          }
        }
      }
    `;

    it('Creates a FeaturedProduct (singleton)', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            code: 'home_featured',
            name: 'Home featured',
            contentTypeCode: 'featuredProduct',
            fields: { subtitle: 'Sub', image: { id: 1 } },
            translations: [
              {
                languageCode: 'en',
                fields: {
                  title: 'Featured title',
                  seo: {
                    metaTitle: 'Meta',
                    metaDescription: 'Description',
                  },
                },
              },
            ],
          },
        }
      );
      expect(createContentEntry.code).toBe('home_featured');
      expect(createContentEntry.contentTypeCode).toBe('featuredProduct');
      expect(createContentEntry.fields.subtitle).toBe('Sub');
      expect(createContentEntry.translations).toHaveLength(1);
    });

    it('Rejects creating a second FeaturedProduct (singleton)', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            code: 'home_featured_2',
            name: 'Second',
            contentTypeCode: 'featuredProduct',
            fields: { image: { id: 1 } },
            translations: [
              {
                languageCode: 'en',
                fields: {
                  title: 'X',
                  seo: { metaTitle: 'a', metaDescription: 'b' },
                },
              },
            ],
          },
        })
      ).rejects.toThrow(/only allows a single entry/);
    });

    it('Rejects creating an entry missing required image relation', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            code: 'no_image',
            name: 'No image',
            contentTypeCode: 'banner',
            fields: {},
            translations: [{ languageCode: 'en', fields: { title: 'X' } }],
          },
        })
      ).rejects.toThrow(/Required field 'image' is missing/);
    });

    it('Rejects translatable field placed in top-level fields', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            code: 'wrong_translatable',
            name: 'Wrong',
            contentTypeCode: 'banner',
            fields: { image: { id: 1 }, title: 'should be in translations' },
            translations: [],
          },
        })
      ).rejects.toThrow(/translatable/);
    });

    it('Creates a first Banner', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            code: 'top_banner',
            name: 'Top banner',
            contentTypeCode: 'banner',
            fields: { image: { id: 1 }, priority: 1 },
            translations: [
              { languageCode: 'en', fields: { title: 'Top banner EN' } },
            ],
          },
        }
      );
      expect(createContentEntry.code).toBe('top_banner');
      expect(createContentEntry.fields.priority).toBe(1);
    });

    it('Creates a second Banner', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            code: 'side_banner',
            name: 'Side banner',
            contentTypeCode: 'banner',
            fields: { image: { id: 1 }, priority: 2 },
            translations: [
              { languageCode: 'en', fields: { title: 'Side banner EN' } },
            ],
          },
        }
      );
      expect(createContentEntry.code).toBe('side_banner');
      expect(createContentEntry.fields.priority).toBe(2);
    });

    it('Fetches the singleton FeaturedProduct via the shop API', async () => {
      const { featuredProduct } = await shopClient.query(GET_FEATURED_PRODUCT);
      expect(featuredProduct).toBeDefined();
      expect(featuredProduct.code).toBe('home_featured');
      expect(featuredProduct.title).toBe('Featured title');
      expect(featuredProduct.subtitle).toBe('Sub');
      expect(featuredProduct.seo.metaTitle).toBe('Meta');
      expect(featuredProduct.seo.metaDescription).toBe('Description');
      expect(featuredProduct.image.id).toBeTruthy();
    });

    it('Fetches both Banners via the shop API', async () => {
      const { banners } = await shopClient.query(GET_BANNERS);
      expect(banners).toHaveLength(2);
      const codes = banners.map((b: { code: string }) => b.code).sort();
      expect(codes).toEqual(['side_banner', 'top_banner']);
      const top = banners.find(
        (b: { code: string }) => b.code === 'top_banner'
      );
      expect(top.title).toBe('Top banner EN');
      expect(top.priority).toBe(1);
      expect(top.image.id).toBeTruthy();
    });
  });
});
