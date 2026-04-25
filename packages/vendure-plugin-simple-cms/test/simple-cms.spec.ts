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
      expect(getField(iface, 'code')).toBeUndefined();
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
      expect(getField(type, 'code')).toBeUndefined();

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

      // Singleton query: no args, no list, no by-id variants
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
      expect(getField(type, 'code')).toBeUndefined();

      expect(typeRefToString(getField(type, 'title')!.type)).toBe('String!');
      expect(typeRefToString(getField(type, 'priority')!.type)).toBe('Int');
      expect(typeRefToString(getField(type, 'image')!.type)).toBe('Asset!');

      // List query: no args, returns [Banner!]!
      const list = getQueryField(shopSchema, 'banners');
      expect(list).toBeDefined();
      expect(list!.args).toHaveLength(0);
      expect(typeRefToString(list!.type)).toBe('[Banner!]!');

      // By-id query: required `id: ID!`, returns Banner (nullable)
      const byId = getQueryField(shopSchema, 'banner');
      expect(byId).toBeDefined();
      expect(byId!.args).toHaveLength(1);
      expect(byId!.args[0].name).toBe('id');
      expect(typeRefToString(byId!.args[0].type)).toBe('ID!');
      expect(typeRefToString(byId!.type)).toBe('Banner');
    });

    it('Generates the AdminContentEntry type with JSON fields on the admin API', () => {
      const type = getType(adminSchema, 'AdminContentEntry');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('OBJECT');
      expect(typeRefToString(getField(type, 'id')!.type)).toBe('ID!');
      expect(getField(type, 'code')).toBeUndefined();
      expect(getField(type, 'name')).toBeUndefined();
      expect(typeRefToString(getField(type, 'fields')!.type)).toBe('JSON!');
    });
  });

  describe('createContentEntry admin mutation + shop API fetches', () => {
    let topBannerId: string;
    let sideBannerId: string;

    const CREATE_CONTENT_ENTRY = gql`
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

    const GET_FEATURED_PRODUCT = gql`
      query GetFeaturedProduct {
        featuredProduct {
          id
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
          title
          priority
          image {
            id
          }
        }
      }
    `;

    const GET_BANNER_BY_ID = gql`
      query GetBanner($id: ID!) {
        banner(id: $id) {
          id
          title
          priority
        }
      }
    `;

    it('Creates a FeaturedProduct (singleton)', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
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
      expect(createContentEntry.id).toBeTruthy();
      expect(createContentEntry.contentTypeCode).toBe('featuredProduct');
      expect(createContentEntry.fields.subtitle).toBe('Sub');
      expect(createContentEntry.translations).toHaveLength(1);
    });

    it('Rejects creating a second FeaturedProduct (singleton)', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
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
            contentTypeCode: 'banner',
            fields: { image: { id: 1 }, priority: 1 },
            translations: [
              { languageCode: 'en', fields: { title: 'Top banner EN' } },
            ],
          },
        }
      );
      expect(createContentEntry.id).toBeTruthy();
      expect(createContentEntry.fields.priority).toBe(1);
      topBannerId = createContentEntry.id;
    });

    it('Creates a second Banner', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            contentTypeCode: 'banner',
            fields: { image: { id: 1 }, priority: 2 },
            translations: [
              { languageCode: 'en', fields: { title: 'Side banner EN' } },
            ],
          },
        }
      );
      expect(createContentEntry.id).toBeTruthy();
      expect(createContentEntry.fields.priority).toBe(2);
      sideBannerId = createContentEntry.id;
    });

    it('Fetches the singleton FeaturedProduct via the shop API', async () => {
      const { featuredProduct } = await shopClient.query(GET_FEATURED_PRODUCT);
      expect(featuredProduct).toBeDefined();
      expect(featuredProduct.title).toBe('Featured title');
      expect(featuredProduct.subtitle).toBe('Sub');
      expect(featuredProduct.seo.metaTitle).toBe('Meta');
      expect(featuredProduct.seo.metaDescription).toBe('Description');
      expect(featuredProduct.image.id).toBeTruthy();
    });

    it('Fetches both Banners via the shop API', async () => {
      const { banners } = await shopClient.query(GET_BANNERS);
      expect(banners).toHaveLength(2);
      const ids = banners.map((b: { id: string }) => b.id).sort();
      expect(ids).toEqual([topBannerId, sideBannerId].sort());
    });

    it('Fetches a single Banner by id via the shop API', async () => {
      const { banner } = await shopClient.query(GET_BANNER_BY_ID, {
        id: topBannerId,
      });
      expect(banner).toBeDefined();
      expect(banner.id).toBe(topBannerId);
      expect(banner.title).toBe('Top banner EN');
      expect(banner.priority).toBe(1);
    });

    it('Returns null when banner(id:) is called with an unknown id', async () => {
      const { banner } = await shopClient.query(GET_BANNER_BY_ID, {
        id: '999999',
      });
      expect(banner).toBeNull();
    });
  });
});
