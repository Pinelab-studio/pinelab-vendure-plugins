import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  CustomerService,
  DefaultLogger,
  Injector,
  LogLevel,
  mergeConfig,
  OrderService,
  ProductService,
  RequestContext,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { getSuperadminContextInChannel } from '../../util/src/superadmin-request-context';
import { assignAllProductsToChannel } from '../src';
import { assignCustomersToChannel } from '../src/assign-customers-to-channel';
import { assignOrdersToChannel } from '../src/assign-orders-to-channel';
import { CREATE_CHANNEL, createChannelInput } from './test-helpers';

describe('Vendure Scripts', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;
  let defaultChannelId = 1;
  let newChannelId = 2;
  let injector: Injector;
  let sourceChannelCtx: RequestContext;
  let targetChannelCtx: RequestContext;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      apiOptions: {
        port: 1234,
      },
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
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
      customerCount: 5,
    });
    serverStarted = true;
    //create one additional channel here
    await adminClient.asSuperAdmin();
    await adminClient.query(CREATE_CHANNEL, {
      input: {
        ...createChannelInput,
        sellerId: 'T_1',
      },
    });
    injector = new Injector(server.app.get(ModuleRef));
    const channelService = server.app.get(ChannelService);
    const sourceChannel = await channelService.findOne(
      sourceChannelCtx,
      defaultChannelId
    );
    sourceChannelCtx = await getSuperadminContextInChannel(
      injector,
      sourceChannel!
    );
    const targetChannel = await channelService.findOne(
      sourceChannelCtx,
      newChannelId
    );
    targetChannelCtx = await getSuperadminContextInChannel(
      injector,
      targetChannel!
    );
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should assign all products from source to target channel', async () => {
    await assignAllProductsToChannel(
      defaultChannelId,
      newChannelId,
      injector,
      sourceChannelCtx
    );
    //test if the assinging worked
    const targetChannelProducts = (
      await server.app
        .get(ProductService)
        .findAll(targetChannelCtx, undefined, [
          'featuredAsset',
          'assets',
          'channels',
          'facetValues',
          'facetValues.facet',
          'variants',
        ])
    ).items;
    expect(targetChannelProducts[0].id).toBe(1);
    //check variants
    expect(targetChannelProducts[0].variants[0].id).toBe(1);
    expect(targetChannelProducts[0].variants[1].id).toBe(2);
    expect(targetChannelProducts[0].variants[2].id).toBe(3);
    expect(targetChannelProducts[0].variants[3].id).toBe(4);
    //check facets
    expect(targetChannelProducts[0].facetValues[0].id).toBe(1);
    expect(targetChannelProducts[0].facetValues[0].facetId).toBe(1);
    expect(targetChannelProducts[0].facetValues[1].id).toBe(2);
    expect(targetChannelProducts[0].facetValues[1].facetId).toBe(2);
  });

  it('Should assign all customers from source  to target channel', async () => {
    await assignCustomersToChannel(
      defaultChannelId,
      newChannelId,
      injector,
      sourceChannelCtx
    );
    const customersInTargetChannel = (
      await server.app.get(CustomerService).findAll(targetChannelCtx, undefined)
    ).items;
    const customersInSourceChannel = (
      await server.app.get(CustomerService).findAll(sourceChannelCtx, undefined)
    ).items;
    expect(customersInTargetChannel.length).toBe(5);
    for (let sourceChannelCustomer of customersInSourceChannel) {
      expect(
        customersInTargetChannel.find(
          (targetChannelCustomer) =>
            targetChannelCustomer.id === sourceChannelCustomer.id
        )
      ).toBeDefined();
    }
  });

  it('Should assign all Orders from source to target Channel', async () => {
    await createSettledOrder(shopClient, 1);
    await createSettledOrder(shopClient, 1);
    await assignOrdersToChannel(
      defaultChannelId,
      newChannelId,
      injector,
      sourceChannelCtx
    );
    const ordersInTargetChannel = (
      await server.app.get(OrderService).findAll(targetChannelCtx, undefined)
    ).items;
    const ordersInSourceChannel = (
      await server.app.get(OrderService).findAll(sourceChannelCtx, undefined)
    ).items;
    expect(ordersInSourceChannel.length).toBe(2);
    expect(ordersInTargetChannel.length).toBe(2);
  });
});
