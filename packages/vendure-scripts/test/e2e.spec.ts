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
import { assignAllProductsToChannel } from '../src/assign-all-products-to-channel';
import { getSuperadminContextInChannel } from '../../test/src/admin-utils';

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
      await getSuperadminContextInChannel(server.app, targetChannel!);
    const sourceChannelProducts = (
      await server.app
        .get(ProductService)
        .findAll(superadminContextInSourceChannel)
    ).items;
    const targetChannelProducts = (
      await server.app
        .get(ProductService)
        .findAll(superadminContextInTargetChannel)
    ).items;
    for (let sourceChannelProduct of sourceChannelProducts) {
      expect(
        targetChannelProducts.find(
          (targetChannelProduct) =>
            targetChannelProduct.id === sourceChannelProduct.id
        )
      ).toBeDefined();
    }
  });
});
