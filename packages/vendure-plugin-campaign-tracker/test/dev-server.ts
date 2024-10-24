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
  AddCampaignToOrderMutation,
  CreateCampaignMutation,
  CreateCampaignMutationVariables,
  GetCampaignsQuery,
  GetCampaignsQueryVariables,
  MutationAddCampaignToOrderArgs,
  SortOrder,
} from '../src/ui/generated/graphql';
import {
  ADD_CAMPAIGN_TO_ORDER,
  CREATE_CAMPAIGN,
  GET_CAMPAIGNS,
} from '../src/ui/queries';

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
  const { addCampaignToOrder } = await shopClient.query<
    AddCampaignToOrderMutation,
    MutationAddCampaignToOrderArgs
  >(ADD_CAMPAIGN_TO_ORDER, { campaignCode: 'test_campaign' });
  await new Promise((resolve) => setTimeout(resolve, 1200)); // Some time between adding codes
  await shopClient.query<
    AddCampaignToOrderMutation,
    MutationAddCampaignToOrderArgs
  >(ADD_CAMPAIGN_TO_ORDER, { campaignCode: 'campaign2' });
  console.log(`Added campaigns to order ${addCampaignToOrder.code}`);

  const order = await createSettledOrder(shopClient, 1, false);
  console.log(`Settled order ${order.code}`);

  // Fetching first should trigger the metrics calculation
  await adminClient.query<GetCampaignsQuery, GetCampaignsQueryVariables>(
    GET_CAMPAIGNS
  );
  console.log('Fetching campaigns, thus triggering metrics calculation');
  // Await async metric processing
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const result = await adminClient.query<
    GetCampaignsQuery,
    GetCampaignsQueryVariables
  >(GET_CAMPAIGNS, {
    options: {
      sort: {
        revenueLast7days: SortOrder.Desc,
      },
    },
  });
  console.log(`Campaign results: ${JSON.stringify(result, null, 2)}`);
})();
