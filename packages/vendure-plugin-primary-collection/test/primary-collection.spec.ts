import {
  AutoIncrementIdStrategy,
  ChannelService,
  Collection,
  CurrencyCode,
  DefaultLogger,
  LanguageCode,
  LogLevel,
  Product,
  Role,
  RoleService,
  isGraphQlErrorResult,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialTestData } from './initial-test-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { PrimaryCollectionPlugin } from '../src/primary-collection-plugin';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { expect, describe, beforeAll, afterAll, it } from 'vitest';
import { gql } from 'graphql-tag';
import { PrimaryCollectionHelperService } from '../src/api/primary-collections-helper.service';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { ProductPrimaryCollection } from '../src/util';

describe('Product Primary Collection', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  const secondChannelToken = 'second-channel-token';

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3106,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [PrimaryCollectionPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
      entityOptions: {
        entityIdStrategy: new AutoIncrementIdStrategy(),
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialTestData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: './test/products.csv',
      customerCount: 2,
    });
    serverStarted = true;
    await adminClient.asSuperAdmin();
    //we should create a second Channel
    const channelService = server.app.get(ChannelService);
    const ctx = await getSuperadminContext(server.app);
    const createChannelResult = await channelService.create(ctx, {
      code: 'second-channel',
      defaultLanguageCode: LanguageCode.en,
      defaultCurrencyCode: CurrencyCode.USD,
      defaultShippingZoneId: 1,
      defaultTaxZoneId: 1,
      pricesIncludeTax: false,
      token: secondChannelToken,
    });
    if (isGraphQlErrorResult(createChannelResult)) {
      throw createChannelResult;
    }
    const roleService = server.app.get(RoleService);
    const superadminRole = await roleService.getSuperAdminRole(ctx);
    await channelService.assignToChannels(ctx, Role, superadminRole.id, [
      createChannelResult.id,
    ]);
    await channelService.assignToChannels(ctx, Product, 1, [
      createChannelResult.id,
    ]);
    await channelService.assignToChannels(ctx, Collection, 5, [
      createChannelResult.id,
    ]);
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  const primaryCollectionQuery = gql`
    query PrimaryCollectionQuery($productId: ID) {
      product(id: $productId) {
        id
        name
        primaryCollection {
          id
          name
        }
      }
    }
  `;

  const updatePrimaryCollectionMutation = gql`
    mutation UpdateProuductPrimaryCollection(
      $productId: ID!
      $primaryCollection: [String!]
    ) {
      updateProduct(
        input: {
          id: $productId
          customFields: { primaryCollection: $primaryCollection }
        }
      ) {
        name
        id
        primaryCollection {
          name
          id
        }
      }
    }
  `;

  it("Should successfully update 'Laptop's primaryCollection as 'Electronics' in the default channel", async () => {
    const { updateProduct: product } = await adminClient.query(
      updatePrimaryCollectionMutation,
      {
        productId: 1,
        primaryCollection: [
          JSON.stringify({
            channelId: 1,
            collectionId: 3,
          } as ProductPrimaryCollection),
        ],
      }
    );
    expect(product.name).toBe('Laptop');
    expect(product.id).toBe('1');
    expect(product.primaryCollection.name).toBe('Electronics');
  });

  it('Should not have a PrimaryCollection set for `Laptop` in the second channel', async () => {
    adminClient.setChannelToken(secondChannelToken);
    const { product } = await adminClient.query(primaryCollectionQuery, {
      productId: 1,
    });
    expect(product.name).toBe('Laptop');
    expect(product.id).toBe('1');
    expect(product.primaryCollection?.name).toBeUndefined();
  });

  it("Should return 'Electronics' as a primary collection for 'Laptop' in Shop API in the default channel", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 1,
    });
    expect(product.name).toBe('Laptop');
    expect(product.primaryCollection.name).toBe('Electronics');
  });

  it("Shouldn't have primaryCollections set on products with id 2 and 3", async () => {
    const { product } = await shopClient.query(primaryCollectionQuery, {
      productId: 2,
    });
    const { product: anotherProduct } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 3,
      }
    );
    expect(product.primaryCollection).toBeNull();
    expect(anotherProduct.primaryCollection).toBeNull();
  });

  it(`Should assign primaryCollection to all products after running the "setPrimaryCollectionForAllProducts" function, 
  while preserving the values for those products who already had `, async () => {
    const ctx = await getSuperadminContext(server.app);
    await server.app
      .get(PrimaryCollectionHelperService)
      .setPrimaryCollectionForAllProducts(ctx);
    const { product: t1Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 1,
      }
    );
    const { product: t2Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 2,
      }
    );
    const { product: t3Product } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 3,
      }
    );
    //Although Product(1),Laptop, belongs to the Collection Electronics, since Electronics is a private collection, we dont expect it to be it's Primary Collection
    expect(t1Product.primaryCollection.name).not.toBe('Electronics');
    expect(t1Product.primaryCollection.name).toBe('Computers');
    //The Product(2), Cars, only belongs to the private Collection Electronics
    expect(t2Product.primaryCollection).toBeNull();
    //The Product(3), Motors, belongs to the  non-private Collection Others
    expect(t3Product.primaryCollection).not.toBeNull();
    // Product(1),Laptop, will have the Collection `Hardware` as the primaryCollection because of the following two reasons:
    //1. It(Laptop) belongs to it
    //2. it is the only Collection that belongs to the second channel
    shopClient.setChannelToken(secondChannelToken);
    const { product: t1ProductDetailInSecondChannel } = await shopClient.query(
      primaryCollectionQuery,
      {
        productId: 1,
      }
    );
    expect(t1ProductDetailInSecondChannel.primaryCollection.name).toBe(
      'Hardware'
    );
  });

  if (process.env.TEST_ADMIN_UI) {
    it('Should compile admin', async () => {
      const files = await getFilesInAdminUiFolder(
        __dirname,
        PrimaryCollectionPlugin.ui
      );
      expect(files?.length).toBeGreaterThan(0);
    }, 200000);
  }

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
