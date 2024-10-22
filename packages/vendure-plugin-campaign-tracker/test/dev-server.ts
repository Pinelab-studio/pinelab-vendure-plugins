import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  OrderProcess,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { addShippingMethod } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CampaignTrackerPlugin } from '../src';
import { CREATE_CAMPAIGN, GET_CAMPAIGNS } from '../src/ui/queries';
import {
  CreateCampaignMutation,
  CreateCampaignMutationVariables,
  GetCampaignsQuery,
  GetCampaignsQueryVariables,
} from '../src/ui/generated/graphql';

(async () => {
  require('dotenv').config();
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    orderOptions: {
      process: [
        configureDefaultOrderProcess({
          checkFulfillmentStates: false,
        }) as OrderProcess<any>,
      ],
    },
    paymentOptions: {
      paymentMethodHandlers: [testPaymentMethod],
    },
    customFields: {
      // Sample custom field to test the custom fields config behavior
      ProductVariant: [
        {
          name: 'noLongerAvailable',
          type: 'string',
        },
      ],
    },
    plugins: [
      CampaignTrackerPlugin.init({}),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        // app: compileUiExtensions({
        //   outputPath: path.join(__dirname, '__admin-ui'),
        //   extensions: [PicqerPlugin.ui],
        //   devMode: true,
        // }),
      }),
    ],
  });
  const { server, shopClient, adminClient } = createTestEnvironment(config);
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
  await adminClient.asSuperAdmin();
  await adminClient.query<
    CreateCampaignMutation,
    CreateCampaignMutationVariables
  >(CREATE_CAMPAIGN, {
    input: {
      code: 'test_campaign',
      name: 'Test Campaign',
    },
  });
  const result = await adminClient.query<
    GetCampaignsQuery,
    GetCampaignsQueryVariables
  >(GET_CAMPAIGNS);
  console.log(result);

  // const order = await createSettledOrder(shopClient, 3, true, [
  //   { id: 'T_1', quantity: 3 },
  // ]);
})();
