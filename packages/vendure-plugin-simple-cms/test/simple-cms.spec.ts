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
      expect(typeRefToString(getField(type, 'fields')!.type)).toBe('JSON');
    });
  });
});
