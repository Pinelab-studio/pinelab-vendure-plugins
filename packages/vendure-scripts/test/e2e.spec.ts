import {
  ChannelService,
  DefaultLogger,
  Injector,
  LogLevel,
  ProductService,
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
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { describe, beforeAll, it, expect } from 'vitest';
import { CREATE_CHANNEL, createChannelInput } from './test-helpers';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { ModuleRef } from '@nestjs/core';
import { assignAllProductsToChannel } from '../src';
import { getSuperadminContextInChannel } from '../../util/src/superadmin-request-context';

describe('Vendure Scripts', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let serverStarted = false;
  let defaultChannelId = 1;
  let newChannelId = 2;

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
  }, 60000);

  it('Should start successfully', async () => {
    expect(serverStarted).toBe(true);
  });

  it('Should assign all products from source channel to target channel', async () => {
    const superadminContextInSourceChannel = await getSuperadminContext(
      server.app
    );
    const injector = new Injector(server.app.get(ModuleRef));
    await assignAllProductsToChannel(
      defaultChannelId,
      newChannelId,
      injector,
      superadminContextInSourceChannel
    );
    //test if the assinging worked
    const channelService = server.app.get(ChannelService);
    const targetChannel = await channelService.findOne(
      superadminContextInSourceChannel,
      newChannelId
    );
    const superadminContextInTargetChannel =
      await getSuperadminContextInChannel(injector, targetChannel!);
    const targetChannelProducts = (
      await server.app
        .get(ProductService)
        .findAll(superadminContextInTargetChannel, undefined, [
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
});
