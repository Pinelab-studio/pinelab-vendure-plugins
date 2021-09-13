import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig, TestServer
} from "@vendure/testing";
import { DefaultLogger, DefaultSearchPlugin, LogLevel, mergeConfig } from "@vendure/core";
import { MyparcelPlugin } from "../src/myparcel.plugin";
import { AdminUiPlugin } from "@vendure/admin-ui-plugin";
import { testPaymentMethod } from "../../test/src/test-payment-method";
import { initialData } from "../../test/src/initial-data";
import {
  addItem,
  addPaymentToOrder,
  addShippingMethod,
  fulfill,
  proceedToArrangingPayment
} from "../../test/src/test-utils";

describe('MyParcel', () => {

  let shopClient: SimpleGraphQLClient;
  let adminClient: SimpleGraphQLClient;
  let server: TestServer;

  beforeAll(async () => {
    registerInitializer("sqljs", new SqljsInitializer("__data__"));
    const devConfig = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        MyparcelPlugin.init({
          "e2e-default-channel": 'test-api-key'
        }),
        DefaultSearchPlugin,
        AdminUiPlugin.init({
          port: 3002,
          route: "admin"
        })
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod]
      }
    });
    const env = createTestEnvironment(devConfig);
    shopClient = env.shopClient;
    adminClient = env.adminClient;
    server = env.server
    await server.init({
      initialData,
      productsCsvPath: "../test/src/products-import.csv",
      customerCount: 2
    });
  }, 10000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Setup order untill payment', async () => {
    await addShippingMethod(adminClient, "my-parcel");
    await shopClient.asUserWithCredentials("hayden.zieme12@hotmail.com", "test");
    await addItem(shopClient, "T_1", 1);
    await addItem(shopClient, "T_2", 2);
    await proceedToArrangingPayment(shopClient);
    await addPaymentToOrder(shopClient, testPaymentMethod.code);
    expect(shopClient).toBeDefined();
  });

  it('Fulfill order with MyParcel', async () => {
    const fulfillment = await fulfill(adminClient, 'my-parcel', [['T_1', 1], ['T_2', 2]]);
    expect(fulfillment.state).toEqual('pending');
  });

});