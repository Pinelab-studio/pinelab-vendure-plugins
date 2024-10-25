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
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CampaignTrackerPlugin, LastInteractionAttribution } from '../src';
import {
  CreateCampaignMutation,
  CreateCampaignMutationVariables,
  GetCampaignsQuery,
  GetCampaignsQueryVariables,
  MutationAddCampaignToOrderArgs,
  SortOrder,
} from '../src/ui/generated/graphql';
import { CREATE_CAMPAIGN, GET_CAMPAIGNS } from '../src/ui/queries';
import { ADD_CAMPAIGN_TO_ORDER } from './queries';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';
import path from 'path';

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
      CampaignTrackerPlugin.init({
        attributionModel: new LastInteractionAttribution(),
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [CampaignTrackerPlugin.ui],
          devMode: true,
        }),
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
  // await addShippingMethod(adminClient, 'manual-fulfillment');
  const {
    createCampaign: { code },
  } = await adminClient.query<
    CreateCampaignMutation,
    CreateCampaignMutationVariables
  >(CREATE_CAMPAIGN, {
    input: {
      code: 'test_campaign',
      name: 'Test Campaign',
    },
  });
  console.log(`Created campaign ${code}`);
  const {
    createCampaign: { code: code2 },
  } = await adminClient.query<
    CreateCampaignMutation,
    CreateCampaignMutationVariables
  >(CREATE_CAMPAIGN, {
    input: {
      code: 'campaign2',
      name: 'Campaign 2',
    },
  });
  console.log(`Created campaign ${code2}`);

  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  // Add test campaign
  const { addCampaignToOrder } = await shopClient.query(ADD_CAMPAIGN_TO_ORDER, {
    campaignCode: 'test_campaign',
  });
  await new Promise((resolve) => setTimeout(resolve, 1200)); // Some time between adding codes
  // Add campaign2
  await shopClient.query(ADD_CAMPAIGN_TO_ORDER, { campaignCode: 'campaign2' });
  console.log(`Added campaigns to order ${addCampaignToOrder.code}`);
  // Place order
  const order = await createSettledOrder(shopClient, 1, false);
  console.log(`Settled order ${order.code}`);

  // Fetching first should trigger the metrics calculation
  await adminClient.query<GetCampaignsQuery, GetCampaignsQueryVariables>(
    GET_CAMPAIGNS
  );
})();
