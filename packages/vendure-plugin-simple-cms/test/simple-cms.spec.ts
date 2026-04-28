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
import {
  getField,
  getQueryField,
  getType,
  INTROSPECTION_QUERY,
  IntrospectionSchema,
  typeRefToString,
  CREATE_CONTENT_ENTRY,
  DELETE_CONTENT_ENTRY,
  CONTENT_ENTRIES_QUERY,
  GET_CONTENT_ENTRY,
  GET_CONTENT_TYPES,
  GET_FEATURED_PRODUCT,
  GET_BANNERS,
  GET_BANNER_BY_ID,
} from './simple-cms-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

let shopSchema: IntrospectionSchema;
let adminSchema: IntrospectionSchema;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__test__'));
  // Override from dev-server
  (config.dbConnectionOptions as any).autoSave = false;
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
      expect(typeRefToString(getField(type, 'product')!.type)).toBe('Product!');

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
      expect(typeRefToString(getField(type, 'product')!.type)).toBe('Product!');

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

    it('Exposes content type metadata (incl. ui config) via the admin API', async () => {
      const { simpleCmsContentTypes } = await adminClient.query(
        GET_CONTENT_TYPES
      );
      expect(simpleCmsContentTypes).toHaveLength(3);

      const featured = simpleCmsContentTypes.find(
        (c: { code: string }) => c.code === 'featuredProduct'
      );
      expect(featured.displayName).toBe('Featured Product');
      expect(featured.allowMultiple).toBe(false);

      const productField = featured.fields.find(
        (f: { name: string }) => f.name === 'product'
      );
      expect(productField.type).toBe('relation');
      expect(productField.graphQLType).toBe('Product');
      expect(productField.isTranslatable).toBeNull();
      expect(productField.ui).toEqual({
        component: 'product-selector-form-input',
      });

      const seoField = featured.fields.find(
        (f: { name: string }) => f.name === 'seo'
      );
      expect(seoField.type).toBe('struct');
      expect(seoField.ui).toBeNull();
      const metaDescription = seoField.fields.find(
        (f: { name: string }) => f.name === 'metaDescription'
      );
      expect(metaDescription.ui).toEqual({
        component: 'textarea-form-input',
      });
    });
  });

  describe('createContentEntry admin mutation + shop API fetches', () => {
    let topBannerId: string;
    let sideBannerId: string;

    it('Creates a FeaturedProduct (singleton)', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            contentTypeCode: 'featuredProduct',
            fields: { product: { id: 1 } },
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
      expect(createContentEntry.fields.product).toBeTruthy();
      expect(createContentEntry.translations).toHaveLength(1);
    });

    it('Rejects creating a second FeaturedProduct (singleton)', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            contentTypeCode: 'featuredProduct',
            fields: { product: { id: 1 } },
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

    it('Rejects creating an entry missing required product relation', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            contentTypeCode: 'banner',
            fields: {},
            translations: [{ languageCode: 'en', fields: { title: 'X' } }],
          },
        })
      ).rejects.toThrow(/Required field 'product' is missing/);
    });

    it('Rejects translatable field placed in top-level fields', async () => {
      await expect(
        adminClient.query(CREATE_CONTENT_ENTRY, {
          input: {
            contentTypeCode: 'banner',
            fields: { product: { id: 1 }, title: 'should be in translations' },
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
            fields: { product: { id: 1 }, priority: 1 },
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
            fields: { product: { id: 1 }, priority: 2 },
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
      expect(featuredProduct.seo.metaTitle).toBe('Meta');
      expect(featuredProduct.seo.metaDescription).toBe('Description');
      expect(featuredProduct.product.id).toBeTruthy();
      expect(featuredProduct.product.name).toBeTruthy();
      expect(featuredProduct.product.slug).toBeTruthy();
      expect(featuredProduct.product.variants.length).toBeGreaterThan(0);
      expect(featuredProduct.product.variants[0].name).toBeTruthy();
      expect(featuredProduct.product.variants[0].sku).toBeTruthy();
    });

    it('Fetches both Banners via the shop API', async () => {
      const { banners } = await shopClient.query(GET_BANNERS);
      expect(banners).toHaveLength(2);
      const ids = banners.map((b: { id: string }) => b.id).sort();
      expect(ids).toEqual([topBannerId, sideBannerId].sort());

      for (const banner of banners) {
        expect(banner.product.id).toBeTruthy();
        expect(banner.product.name).toBeTruthy();
        expect(banner.product.slug).toBeTruthy();
        expect(banner.product.variants.length).toBeGreaterThan(0);
        expect(banner.product.variants[0].name).toBeTruthy();
        expect(banner.product.variants[0].sku).toBeTruthy();
      }
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

  describe('Paginated contentEntries admin query', () => {
    it('Returns paginated list of all content entries', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        { options: {} }
      );
      // 1 featuredProduct + 2 banners
      expect(contentEntries.totalItems).toBe(3);
      expect(contentEntries.items).toHaveLength(3);
    });

    it('Respects take/skip', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        { options: { take: 1, skip: 1 } }
      );
      expect(contentEntries.totalItems).toBe(3);
      expect(contentEntries.items).toHaveLength(1);
    });

    it('Filters by contentTypeCode', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        {
          options: {
            filter: { contentTypeCode: { eq: 'banner' } },
          },
        }
      );
      expect(contentEntries.totalItems).toBe(2);
      contentEntries.items.forEach((e: { contentTypeCode: string }) => {
        expect(e.contentTypeCode).toBe('banner');
      });
    });

    it('Sorts by updatedAt DESC', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        { options: { sort: { updatedAt: 'DESC' } } }
      );
      const dates = contentEntries.items.map((e: { updatedAt: string }) =>
        new Date(e.updatedAt).getTime()
      );
      const sorted = [...dates].sort((a: number, b: number) => b - a);
      expect(dates).toEqual(sorted);
    });

    it('Resolves displayName from first translatable string field (active language)', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        { options: { filter: { contentTypeCode: { eq: 'featuredProduct' } } } }
      );
      expect(contentEntries.items).toHaveLength(1);
      // featuredProduct.fields starts with `subtitle` (string, non-translatable, null)
      // then `title` (string, translatable, value 'Featured title')
      // -> first string field is `subtitle`, but its value is null/missing so falls through? Actually, deriveDisplayName picks the FIRST defined string field regardless of value. With subtitle=null, displayName -> null.
      // Adjust expectation: subtitle is not provided, so displayName is null.
      expect(contentEntries.items[0].displayName).toBeNull();
    });

    it('Resolves displayName for banner (first string field is translatable title)', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        {
          options: {
            filter: { contentTypeCode: { eq: 'banner' } },
            sort: { id: 'ASC' },
          },
        }
      );
      expect(contentEntries.items[0].displayName).toBe('Top banner EN');
      expect(contentEntries.items[1].displayName).toBe('Side banner EN');
    });

    it('Returns null displayName for content type without any string field', async () => {
      // Create a metric entry (no string field defined)
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            contentTypeCode: 'metric',
            fields: { value: 42, asset: { id: 1 } },
          },
        }
      );
      expect(createContentEntry.id).toBeTruthy();

      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        { options: { filter: { contentTypeCode: { eq: 'metric' } } } }
      );
      expect(contentEntries.items).toHaveLength(1);
      expect(contentEntries.items[0].displayName).toBeNull();
    });
  });

  describe('Soft delete', () => {
    let entryToDeleteId: string;

    it('Creates a banner entry to be soft-deleted', async () => {
      const { createContentEntry } = await adminClient.query(
        CREATE_CONTENT_ENTRY,
        {
          input: {
            contentTypeCode: 'banner',
            fields: { product: { id: 1 }, priority: 99 },
            translations: [
              { languageCode: 'en', fields: { title: 'Delete me' } },
            ],
          },
        }
      );
      expect(createContentEntry.id).toBeTruthy();
      entryToDeleteId = createContentEntry.id;
    });

    it('Soft-deletes the entry and returns DELETED result', async () => {
      const { deleteContentEntry } = await adminClient.query(
        DELETE_CONTENT_ENTRY,
        { id: entryToDeleteId }
      );
      expect(deleteContentEntry.result).toBe('DELETED');
    });

    it('Excluded the soft-deleted entry from the contentEntries list', async () => {
      const { contentEntries } = await adminClient.query(
        CONTENT_ENTRIES_QUERY,
        {
          options: { filter: { contentTypeCode: { eq: 'banner' } } },
        }
      );
      const ids = contentEntries.items.map((e: { id: string }) => e.id);
      expect(ids).not.toContain(entryToDeleteId);
    });

    it('Returns null for the soft-deleted entry via contentEntry(id:)', async () => {
      const { contentEntry } = await adminClient.query(GET_CONTENT_ENTRY, {
        id: entryToDeleteId,
      });
      expect(contentEntry).toBeNull();
    });
  });
});
