import { DefaultLogger, EventBus, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
  TestServer,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { waitFor } from '../../test/src/test-helpers';
import {
  AdditionalCheckResult,
  ChannelContentScanCompletedEvent,
  ContentCheckService,
  ContentHealthPlugin,
} from '../src';

const STOREFRONT_ORIGIN = 'https://storefront.test';

const CREATE_PRODUCT = gql`
  mutation CreateTestProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
    }
  }
`;
const UPDATE_PRODUCT = gql`
  mutation UpdateTestProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
    }
  }
`;
const CREATE_COLLECTION = gql`
  mutation CreateTestCollection($input: CreateCollectionInput!) {
    createCollection(input: $input) {
      id
    }
  }
`;
const GET_CONTENT_CHECK_RESULTS = gql`
  query GetContentCheckResults($entityType: String!, $entityId: String!) {
    contentCheckResults(entityType: $entityType, entityId: $entityId) {
      id
      label
      url
      hasError
      hasWarning
      messages {
        source
        severity
        code
        message
      }
    }
  }
`;
const GET_CONTENT_CHECK_OVERVIEW = gql`
  query GetContentCheckOverview($options: ContentCheckOverviewListOptions) {
    contentCheckOverview(options: $options) {
      items {
        entityType
        entityId
        name
        hasError
        hasWarning
        errorCount
        warningCount
        languageCodes
        preview
      }
      totalItems
    }
  }
`;
const RUN_CONTENT_CHECK_FOR_PRODUCT = gql`
  mutation RunContentCheckForProduct($productId: ID!) {
    runContentCheckForProduct(productId: $productId) {
      id
      languageCode
      hasError
      hasWarning
      messages {
        source
        severity
        code
        message
      }
    }
  }
`;
const GET_CONTENT_CHECK_ENTITY_TYPES = gql`
  query GetContentCheckEntityTypes {
    contentCheckEntityTypes
  }
`;
const RUN_CONTENT_SEO_MONITOR_FULL_SCAN = gql`
  mutation RunContentHealthFullScan {
    runContentHealthFullScan {
      channelsScanned
      entitiesChecked
    }
  }
`;
const CREATE_CHANNEL = gql`
  mutation CreateTestChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
        token
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;
const ASSIGN_PRODUCTS_TO_CHANNEL = gql`
  mutation AssignTestProductsToChannel($input: AssignProductsToChannelInput!) {
    assignProductsToChannel(input: $input) {
      id
    }
  }
`;

function goodProductHtml(url: string): string {
  return `<html><head>
    <title>${'a'.repeat(55)}</title>
    <meta name="description" content="${'b'.repeat(150)}" />
    <link rel="alternate" hreflang="en" href="${url}" />
    <link rel="alternate" hreflang="x-default" href="${url}" />
    <script type="application/ld+json">${JSON.stringify([
      { '@type': 'Product' },
      { '@type': 'ProductGroup' },
      { '@type': 'BreadcrumbList' },
      { '@type': 'Organization' },
    ])}</script>
  </head><body></body></html>`;
}

function goodCollectionHtml(url: string): string {
  return `<html><head>
    <title>${'a'.repeat(55)}</title>
    <meta name="description" content="${'b'.repeat(150)}" />
    <link rel="alternate" hreflang="en" href="${url}" />
    <link rel="alternate" hreflang="x-default" href="${url}" />
    <script type="application/ld+json">${JSON.stringify([
      { '@type': 'BreadcrumbList' },
    ])}</script>
  </head><body></body></html>`;
}

function sitemapXml(urls: string[]): string {
  const entries = urls.map((u) => `<url><loc>${u}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset>${entries}</urlset>`;
}

interface OverviewItem {
  entityType: string;
  entityId: string;
}

describe('ContentHealthPlugin (e2e)', () => {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let mockAgent: MockAgent;

  let goodProductId: string;
  let goodCollectionId: string;
  let brokenProductId: string;
  let excludedProductId: string;

  /**
   * Products and collections each have their own independent id sequence,
   * so a product and a collection can share the same encoded id — overview
   * lookups must always match on both `entityType` and `entityId`.
   */
  function isBrokenProductOverviewItem(item: OverviewItem): boolean {
    return (
      item.entityType === 'PRODUCT' &&
      String(item.entityId) === String(brokenProductId)
    );
  }

  let excludeProduct = true;
  const configurableCheckCalls: string[] = [];
  const additionalCheckResults: AdditionalCheckResult[] = [];

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        ContentHealthPlugin.init({
          getProductUrl: (ctx, { product, languageCode }) =>
            `${STOREFRONT_ORIGIN}/${languageCode}/products/${product.slug}`,
          getCollectionUrl: (ctx, { collection, languageCode }) =>
            `${STOREFRONT_ORIGIN}/${languageCode}/collections/${collection.slug}`,
          getSitemapUrl: () => `${STOREFRONT_ORIGIN}/sitemap.xml`,
          // Compared by slug, not id: `entity.id` here is the raw internal
          // id, while `excludedProductId` (assigned below, after product
          // creation) is the GraphQL-encoded admin-facing id — the two are
          // not directly comparable.
          shouldCheckEntity: (ctx, entity) =>
            !excludeProduct || entity.slug !== 'excluded-product',
          checks: {
            product: [
              (ctx, { product }) => {
                configurableCheckCalls.push(product.slug);
                return [];
              },
            ],
          },
          additionalChecks: [() => additionalCheckResults],
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });
    ({ server, adminClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: '../test/src/products-import.csv',
    });
    serverStarted = true;

    await adminClient.asSuperAdmin();

    const goodProduct = await adminClient.query(CREATE_PRODUCT, {
      input: {
        translations: [
          {
            languageCode: 'en',
            name: 'Good Product',
            slug: 'good-product',
            description: 'A perfectly fine product.',
          },
        ],
      },
    });
    goodProductId = goodProduct.createProduct.id;

    const brokenProduct = await adminClient.query(CREATE_PRODUCT, {
      input: {
        translations: [
          {
            languageCode: 'en',
            name: 'Broken Product',
            slug: 'broken-product',
            description: 'A product whose storefront page is unreachable.',
          },
        ],
      },
    });
    brokenProductId = brokenProduct.createProduct.id;

    const excludedProduct = await adminClient.query(CREATE_PRODUCT, {
      input: {
        translations: [
          {
            languageCode: 'en',
            name: 'Excluded Product',
            slug: 'excluded-product',
            description: 'A product excluded from content checks.',
          },
        ],
      },
    });
    // Referenced by `shouldCheckEntity` above (plugin init happens before
    // this, but the predicate is only invoked later, once a scan runs).
    excludedProductId = excludedProduct.createProduct.id;

    const goodCollection = await adminClient.query(CREATE_COLLECTION, {
      input: {
        translations: [
          {
            languageCode: 'en',
            name: 'Good Collection',
            slug: 'good-collection',
            description: '',
          },
        ],
        filters: [],
      },
    });
    goodCollectionId = goodCollection.createCollection.id;

    // Persistent, stable mocks for the "always good" entities, covering the
    // whole test file. `broken-product` is deliberately left unmocked here:
    // real network resolution to `storefront.test` fails, so every check
    // against it errors out until the "11.6 + 11.7" test explicitly fixes
    // it — a single, stable ground truth that repeated/duplicate update
    // events (Vendure may publish more than one `ProductEvent` per admin
    // mutation) cannot flip back and forth.
    const goodProductUrl = `${STOREFRONT_ORIGIN}/en/products/good-product`;
    const goodCollectionUrl = `${STOREFRONT_ORIGIN}/en/collections/good-collection`;
    const brokenProductUrl = `${STOREFRONT_ORIGIN}/en/products/broken-product`;
    mockAgent = new MockAgent();
    // Unmocked requests reject immediately instead of attempting real
    // network — this is what makes `broken-product` (deliberately left
    // unmocked below) simulate a page-fetch failure.
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    const storefrontClient = mockAgent.get(STOREFRONT_ORIGIN);
    storefrontClient
      .intercept({ path: '/en/products/good-product', method: 'GET' })
      .reply(200, goodProductHtml(goodProductUrl))
      .persist();
    storefrontClient
      .intercept({ path: '/en/collections/good-collection', method: 'GET' })
      .reply(200, goodCollectionHtml(goodCollectionUrl))
      .persist();
    storefrontClient
      .intercept({ path: '/sitemap.xml', method: 'GET' })
      .reply(
        200,
        sitemapXml([goodProductUrl, goodCollectionUrl, brokenProductUrl])
      )
      .persist();
  }, 60000);

  afterAll(async () => {
    await mockAgent.close();
    await server.destroy();
  }, 100000);

  it('Should start successfully', () => {
    expect(serverStarted).toBe(true);
  });

  it('11.3 + 11.5: full scan checks all non-excluded entities, isolates a broken one, and publishes one event per channel', async () => {
    const eventBus = server.app.get(EventBus);
    const events: ChannelContentScanCompletedEvent[] = [];
    const subscription = eventBus
      .ofType(ChannelContentScanCompletedEvent)
      .subscribe((event) => events.push(event));

    configurableCheckCalls.length = 0;
    await server.app.get(ContentCheckService).runFullScan();
    subscription.unsubscribe();

    // Exactly one event for the single (default) channel in this scan.
    expect(events).toHaveLength(1);
    // At least our 3 non-excluded entities were checked (the scan also
    // covers whatever products the CSV fixture import created).
    expect(events[0].findings.length).toBeGreaterThanOrEqual(3);

    // Note: `events[0].findings[].entityId` are raw, un-encoded internal
    // ids (this is a direct EventBus subscription, not a GraphQL response),
    // so entity-specific assertions below go through the admin API instead,
    // which applies the same id encoding as `goodProductId` etc.

    const goodResults = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'PRODUCT',
      entityId: goodProductId,
    });
    expect(goodResults.contentCheckResults).toHaveLength(1);
    expect(goodResults.contentCheckResults[0].hasError).toBe(false);
    expect(goodResults.contentCheckResults[0].hasWarning).toBe(false);

    const goodCollectionResults = await adminClient.query(
      GET_CONTENT_CHECK_RESULTS,
      { entityType: 'COLLECTION', entityId: goodCollectionId }
    );
    expect(goodCollectionResults.contentCheckResults).toHaveLength(1);
    expect(goodCollectionResults.contentCheckResults[0].hasError).toBe(false);

    const brokenResults = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'PRODUCT',
      entityId: brokenProductId,
    });
    expect(brokenResults.contentCheckResults).toHaveLength(1);
    expect(brokenResults.contentCheckResults[0].hasError).toBe(true);
    expect(
      brokenResults.contentCheckResults[0].messages.some(
        (m: { code: string }) => m.code === 'PAGE_FETCH_FAILED'
      )
    ).toBe(true);

    // The broken entity did not prevent the others (or their configurable
    // checks) from being checked.
    expect(configurableCheckCalls).toContain('good-product');
    expect(configurableCheckCalls).toContain('broken-product');

    // Excluded entity: no check results were ever produced for it.
    const excludedResults = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'PRODUCT',
      entityId: excludedProductId,
    });
    expect(excludedResults.contentCheckResults).toEqual([]);
  });

  it('contentCheckOverview supports filtering by entityType, filtering by name, and pagination', async () => {
    const productsOnly = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: { filter: { entityType: { eq: 'PRODUCT' } } },
    });
    expect(
      productsOnly.contentCheckOverview.items.every(
        (item: { entityType: string }) => item.entityType === 'PRODUCT'
      )
    ).toBe(true);
    expect(productsOnly.contentCheckOverview.items.length).toBeGreaterThan(0);

    const byName = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: { filter: { name: { contains: 'Broken Product' } } },
    });
    expect(byName.contentCheckOverview.items).toHaveLength(1);
    expect(byName.contentCheckOverview.items[0].entityId).toBe(brokenProductId);
    // The overview aggregates across languages, so counts reflect a single
    // row per entity, not one per (entity, language) combination.
    expect(byName.contentCheckOverview.items[0].errorCount).toBeGreaterThan(0);

    const allItems = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: {},
    });
    expect(allItems.contentCheckOverview.totalItems).toBeGreaterThan(1);

    const firstPage = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: { take: 1 },
    });
    expect(firstPage.contentCheckOverview.items).toHaveLength(1);
    expect(firstPage.contentCheckOverview.totalItems).toBe(
      allItems.contentCheckOverview.totalItems
    );
  });

  it('11.2: updating a product triggers its own check and stores a new result', async () => {
    // A prior test (the full scan) already left a saved result for this
    // product, so merely waiting for `contentCheckResults.length > 0` would
    // pass immediately regardless of whether this update actually triggers
    // its own re-check. Wait for the configurable check to run again instead
    // — that only happens on an actual (re-)check.
    configurableCheckCalls.length = 0;

    await adminClient.query(UPDATE_PRODUCT, {
      input: { id: goodProductId, enabled: true },
    });

    const results = await waitFor(async () => {
      if (!configurableCheckCalls.includes('good-product')) {
        return undefined;
      }
      const res = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
        entityType: 'PRODUCT',
        entityId: goodProductId,
      });
      return res.contentCheckResults.length > 0
        ? res.contentCheckResults
        : undefined;
    });

    expect(results[0].hasError).toBe(false);
  }, 20000);

  it('11.4: updating an excluded product stores only an eligibility warning', async () => {
    // No mock intercept is registered for this entity. Reaching the page
    // fetch would therefore produce an error instead of this warning.
    await adminClient.query(UPDATE_PRODUCT, {
      input: { id: excludedProductId, enabled: true },
    });

    const results = await waitFor(async () => {
      const response = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
        entityType: 'PRODUCT',
        entityId: excludedProductId,
      });
      return response.contentCheckResults[0]?.messages[0]?.code ===
        'ENTITY_EXCLUDED'
        ? response.contentCheckResults
        : undefined;
    });

    expect(results).toHaveLength(1);
    expect(results[0].hasError).toBe(false);
    expect(results[0].hasWarning).toBe(true);
    expect(results[0].messages).toEqual([
      {
        source: 'entity-eligibility',
        severity: 'WARNING',
        code: 'ENTITY_EXCLUDED',
        message: 'This entity is excluded from content checks.',
      },
    ]);

    const overview = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: { filter: { name: { contains: 'Excluded Product' } } },
    });
    expect(overview.contentCheckOverview.items).toEqual([]);
  }, 20000);

  it('11.6 + 11.7: overview includes an entity with errors, and drops it (with replaced messages) once fixed', async () => {
    const brokenProductUrl = `${STOREFRONT_ORIGIN}/en/products/broken-product`;

    // Still broken at this point (no mock registered for it at all, so the
    // real fetch to `storefront.test` fails) -> appears in the overview.
    await adminClient.query(UPDATE_PRODUCT, {
      input: { id: brokenProductId, enabled: true },
    });

    await waitFor(async () => {
      const res = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
        entityType: 'PRODUCT',
        entityId: brokenProductId,
      });
      const messages = res.contentCheckResults[0]?.messages ?? [];
      return messages.some(
        (m: { code: string }) => m.code === 'PAGE_FETCH_FAILED'
      )
        ? true
        : undefined;
    });

    const overviewBefore = await adminClient.query(
      GET_CONTENT_CHECK_OVERVIEW,
      {}
    );
    expect(
      overviewBefore.contentCheckOverview.items.some(
        isBrokenProductOverviewItem
      )
    ).toBe(true);

    // Now: fix it (page is reachable and fully valid; the shared sitemap
    // mock from beforeAll already includes this URL) -> re-check replaces
    // the result and it drops off the overview. Registered as `.persist()`
    // so that a duplicate/repeated update event still sees the fixed page.
    mockAgent
      .get(STOREFRONT_ORIGIN)
      .intercept({ path: '/en/products/broken-product', method: 'GET' })
      .reply(200, goodProductHtml(brokenProductUrl))
      .persist();

    await adminClient.query(UPDATE_PRODUCT, {
      input: { id: brokenProductId, enabled: true },
    });

    await waitFor(async () => {
      const res = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
        entityType: 'PRODUCT',
        entityId: brokenProductId,
      });
      return res.contentCheckResults[0]?.hasError === false ? true : undefined;
    });

    const resultsAfter = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'PRODUCT',
      entityId: brokenProductId,
    });
    expect(resultsAfter.contentCheckResults).toHaveLength(1);
    expect(
      resultsAfter.contentCheckResults[0].messages.some(
        (m: { code: string }) => m.code === 'PAGE_FETCH_FAILED'
      )
    ).toBe(false);

    const overviewAfter = await adminClient.query(
      GET_CONTENT_CHECK_OVERVIEW,
      {}
    );
    expect(
      overviewAfter.contentCheckOverview.items.some(isBrokenProductOverviewItem)
    ).toBe(false);
  }, 30000);

  it('additionalChecks: a custom entity type is checked during a full scan and surfaced in the overview and its own detail query', async () => {
    additionalCheckResults.length = 0;
    additionalCheckResults.push({
      entityType: 'administrator',
      entityId: 'admin-1',
      label: 'Super Admin',
      url: '/administrators/1',
      messages: [
        {
          source: 'demo-admin-check',
          severity: 'warning',
          code: 'DEMO_CUSTOM_CHECK',
          message: 'A demo finding from an additionalChecks function.',
        },
      ],
    });

    await server.app.get(ContentCheckService).runFullScan();

    const results = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'administrator',
      entityId: 'admin-1',
    });
    expect(results.contentCheckResults).toHaveLength(1);
    expect(results.contentCheckResults[0].hasWarning).toBe(true);
    expect(results.contentCheckResults[0].label).toBe('Super Admin');
    expect(results.contentCheckResults[0].url).toBe('/administrators/1');
    expect(results.contentCheckResults[0].messages[0].code).toBe(
      'DEMO_CUSTOM_CHECK'
    );

    const overview = await adminClient.query(GET_CONTENT_CHECK_OVERVIEW, {
      options: { filter: { entityType: { eq: 'administrator' } } },
    });
    expect(overview.contentCheckOverview.items).toHaveLength(1);
    expect(overview.contentCheckOverview.items[0]).toMatchObject({
      entityType: 'administrator',
      entityId: 'admin-1',
      name: 'Super Admin',
      hasError: false,
      hasWarning: true,
    });

    // The type filter's options are loaded from this query, so a custom
    // `additionalChecks` entity type must show up alongside the built-ins.
    const entityTypes = await adminClient.query(GET_CONTENT_CHECK_ENTITY_TYPES);
    expect(entityTypes.contentCheckEntityTypes).toEqual(
      expect.arrayContaining(['PRODUCT', 'COLLECTION', 'administrator'])
    );
  }, 20000);

  it('runContentCheckForProduct: manually re-checks a single product on demand and returns its fresh results', async () => {
    const result = await adminClient.query(RUN_CONTENT_CHECK_FOR_PRODUCT, {
      productId: goodProductId,
    });

    expect(result.runContentCheckForProduct).toHaveLength(1);
    expect(result.runContentCheckForProduct[0].hasError).toBe(false);
    expect(result.runContentCheckForProduct[0].hasWarning).toBe(false);
  });

  it('runContentCheckForProduct replaces stale errors with one exclusion warning per enabled language', async () => {
    excludeProduct = false;
    const checkedResult = await adminClient.query(
      RUN_CONTENT_CHECK_FOR_PRODUCT,
      {
        productId: excludedProductId,
      }
    );
    expect(checkedResult.runContentCheckForProduct[0].hasError).toBe(true);

    excludeProduct = true;
    const excludedResult = await adminClient.query(
      RUN_CONTENT_CHECK_FOR_PRODUCT,
      { productId: excludedProductId }
    );

    expect(excludedResult.runContentCheckForProduct).toHaveLength(1);
    expect(excludedResult.runContentCheckForProduct[0]).toMatchObject({
      languageCode: 'en',
      hasError: false,
      hasWarning: true,
      messages: [
        {
          source: 'entity-eligibility',
          severity: 'WARNING',
          code: 'ENTITY_EXCLUDED',
          message: 'This entity is excluded from content checks.',
        },
      ],
    });
  });

  it('runContentHealthFullScan: manually runs a full scan on demand', async () => {
    const result = await adminClient.query(
      RUN_CONTENT_SEO_MONITOR_FULL_SCAN,
      {}
    );

    expect(result.runContentHealthFullScan.channelsScanned).toBe(1);
    // Our 3 non-excluded entities plus whatever the CSV fixture imported.
    expect(
      result.runContentHealthFullScan.entitiesChecked
    ).toBeGreaterThanOrEqual(3);
  }, 20000);

  it('runContentCheckForProduct is isolated to the active channel: does not read or write another channel', async () => {
    const defaultChannelResultsBefore = await adminClient.query(
      GET_CONTENT_CHECK_RESULTS,
      { entityType: 'PRODUCT', entityId: goodProductId }
    );
    expect(defaultChannelResultsBefore.contentCheckResults).toHaveLength(1);

    const createChannelResult = await adminClient.query(CREATE_CHANNEL, {
      input: {
        code: 'seo-monitor-test-channel-2',
        token: 'seo-monitor-test-channel-2-token',
        defaultLanguageCode: 'en',
        defaultCurrencyCode: 'USD',
        pricesIncludeTax: true,
        defaultShippingZoneId: 1,
        defaultTaxZoneId: 1,
      },
    });
    const channel2Id = createChannelResult.createChannel.id as string;
    expect(channel2Id).toBeDefined();

    await adminClient.query(ASSIGN_PRODUCTS_TO_CHANNEL, {
      input: { productIds: [goodProductId], channelId: channel2Id },
    });

    // Run the manual check while scoped to channel 2.
    adminClient.setChannelToken('seo-monitor-test-channel-2-token');
    const channel2Result = await adminClient.query(
      RUN_CONTENT_CHECK_FOR_PRODUCT,
      {
        productId: goodProductId,
      }
    );
    expect(channel2Result.runContentCheckForProduct).toHaveLength(1);

    const channel2Results = await adminClient.query(GET_CONTENT_CHECK_RESULTS, {
      entityType: 'PRODUCT',
      entityId: goodProductId,
    });
    expect(channel2Results.contentCheckResults).toHaveLength(1);

    // Switch back: the default channel's result must be completely
    // unaffected by the check that was just run for channel 2.
    adminClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    const defaultChannelResultsAfter = await adminClient.query(
      GET_CONTENT_CHECK_RESULTS,
      { entityType: 'PRODUCT', entityId: goodProductId }
    );
    expect(defaultChannelResultsAfter.contentCheckResults).toHaveLength(1);
    expect(defaultChannelResultsAfter.contentCheckResults[0].id).toBe(
      defaultChannelResultsBefore.contentCheckResults[0].id
    );
  });
});
