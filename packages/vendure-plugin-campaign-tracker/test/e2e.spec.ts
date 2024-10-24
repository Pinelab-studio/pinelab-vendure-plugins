import { DefaultLogger, LogLevel, mergeConfig, Order } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CampaignTrackerPlugin, LastInteractionAttribution } from '../src';
import getFilesInAdminUiFolder from '../../test/src/compile-admin-ui.util';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CREATE_CAMPAIGN, GET_CAMPAIGNS } from '../src/ui/queries';
import {
  CreateCampaignMutation,
  CreateCampaignMutationVariables,
  GetCampaignsQuery,
  GetCampaignsQueryVariables,
  SortOrder,
} from '../src/ui/generated/graphql';
import { ADD_CAMPAIGN_TO_ORDER } from './queries';
import { createSettledOrder, SettledOrder } from '../../test/src/shop-utils';
import { waitFor } from '../../test/src/test-helpers';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;
let serverStarted = false;
let order1: SettledOrder;
let order2: SettledOrder;
let order3: SettledOrder;

beforeAll(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    apiOptions: {
      port: 3106,
    },
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      CampaignTrackerPlugin.init({
        attributionModel: new LastInteractionAttribution(),
      }),
    ],
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
    customerCount: 2,
  });
  serverStarted = true;
  await adminClient.asSuperAdmin();
}, 30000);

it('Should start successfully', async () => {
  await expect(serverStarted).toBe(true);
});

it('Creates 2 campaigns', async () => {
  const { createCampaign: campaign1 } = await adminClient.query<
    CreateCampaignMutation,
    CreateCampaignMutationVariables
  >(CREATE_CAMPAIGN, {
    input: {
      code: 'campaign1',
      name: 'Campaign 2',
    },
  });
  const { createCampaign: campaign2 } = await adminClient.query<
    CreateCampaignMutation,
    CreateCampaignMutationVariables
  >(CREATE_CAMPAIGN, {
    input: {
      code: 'campaign2',
      name: 'Campaign 2',
    },
  });
  expect(campaign1.code).toBe('campaign1');
  expect(campaign1.id).toBe('T_1');
  expect(campaign2.code).toBe('campaign2');
  expect(campaign2.id).toBe('T_2');
});

it('Adds a campaign without having an active order', async () => {
  const { addCampaignToOrder: order } = await shopClient.query(
    ADD_CAMPAIGN_TO_ORDER,
    {
      campaignCode: 'campaign1',
    }
  );
  expect(order.code).toBeDefined();
});

it("Doesn't create actie order for non-existant campaign code", async () => {
  const { addCampaignToOrder: order } = await shopClient.query(
    ADD_CAMPAIGN_TO_ORDER,
    {
      campaignCode: 'does-not-exist',
    }
  );
  expect(order).toBeNull();
});

it('Places order with 2 campaigns, where campaign1 was added last', async () => {
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_CAMPAIGN_TO_ORDER, {
    campaignCode: 'campaign2',
  });
  await new Promise((resolve) => setTimeout(resolve, 1200)); // Some time between adding codes
  const { addCampaignToOrder } = await shopClient.query(ADD_CAMPAIGN_TO_ORDER, {
    campaignCode: 'campaign1',
  });
  order1 = await createSettledOrder(shopClient, 1, false);
  expect(addCampaignToOrder.code).toBe(order1.code);
});

it('Places 2 orders connected to campaign2', async () => {
  // Place order2
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_CAMPAIGN_TO_ORDER, {
    campaignCode: 'campaign2',
  });
  order2 = await createSettledOrder(shopClient, 1, false);
  expect(order2.code).toBeDefined();
  // Place order3
  await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
  await shopClient.query(ADD_CAMPAIGN_TO_ORDER, {
    campaignCode: 'campaign2',
  });
  order3 = await createSettledOrder(shopClient, 1, false);
});

it('Calculates revenue', async () => {
  // Fetching first should trigger the metrics calculation
  const getCampaigns = async () => {
    const { campaigns } = await adminClient.query<
      GetCampaignsQuery,
      GetCampaignsQueryVariables
    >(GET_CAMPAIGNS);
    return campaigns.items;
  };
  const campaigns = await waitFor(async () => {
    // Wait until all campaigns have revenue
    const campaigns = await getCampaigns();
    if (campaigns.every((c) => c.revenueLast7days > 0)) {
      return campaigns;
    }
  }, 4000);
  expect(campaigns.length).toBe(2);
});

it('Has attributed order1 to campaign1', async () => {
  const { campaigns } = await adminClient.query<
    GetCampaignsQuery,
    GetCampaignsQueryVariables
  >(GET_CAMPAIGNS);
  const campaign1 = campaigns.items.find((c) => c.code === 'campaign1');
  expect(campaign1?.revenueLast7days).toBe(order1.total);
  expect(campaign1?.revenueLast30days).toBe(order1.total);
  expect(campaign1?.revenueLast365Days).toBe(order1.total);
});

it('Has attributed order2 and order3 to campaign2', async () => {
  const { campaigns } = await adminClient.query<
    GetCampaignsQuery,
    GetCampaignsQueryVariables
  >(GET_CAMPAIGNS);
  const campaign2 = campaigns.items.find((c) => c.code === 'campaign2');
  const totalRevenue = order2.total + order3.total;
  expect(campaign2?.revenueLast7days).toBe(totalRevenue);
  expect(campaign2?.revenueLast30days).toBe(totalRevenue);
  expect(campaign2?.revenueLast365Days).toBe(totalRevenue);
});

it('Sorts by revenue ASC', async () => {
  const {
    campaigns: { items: campaigns },
  } = await adminClient.query<GetCampaignsQuery, GetCampaignsQueryVariables>(
    GET_CAMPAIGNS,
    {
      options: { sort: { revenueLast7days: SortOrder.Asc } },
    }
  );
  expect(campaigns[1]?.revenueLast7days).toBeGreaterThan(
    campaigns[0]?.revenueLast7days
  );
});

it('Sorts by revenue DESC', async () => {
  const {
    campaigns: { items: campaigns },
  } = await adminClient.query<GetCampaignsQuery, GetCampaignsQueryVariables>(
    GET_CAMPAIGNS,
    {
      options: { sort: { revenueLast7days: SortOrder.Desc } },
    }
  );
  expect(campaigns[0]?.revenueLast7days).toBeGreaterThan(
    campaigns[1]?.revenueLast7days
  );
});

if (process.env.TEST_ADMIN_UI) {
  it('Should compile admin', async () => {
    const files = await getFilesInAdminUiFolder(
      __dirname,
      CampaignTrackerPlugin.ui
    );
    expect(files?.length).toBeGreaterThan(0);
  }, 200000);
}

afterAll(async () => {
  await server.destroy();
});
