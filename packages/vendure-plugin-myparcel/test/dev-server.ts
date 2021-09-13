import { initialData } from "../../test/src/initial-data";
import { MyparcelPlugin } from "../src/myparcel.plugin";
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from "@vendure/testing";
import { DefaultLogger, DefaultSearchPlugin, LogLevel, mergeConfig } from "@vendure/core";
import { AdminUiPlugin } from "@vendure/admin-ui-plugin";
import { addItem, addPaymentToOrder, addShippingMethod, proceedToArrangingPayment } from "../../test/src/test-utils";
import { testPaymentMethod } from "../../test/src/test-payment-method";

require("dotenv").config();

(async () => {
  registerInitializer("sqljs", new SqljsInitializer("__data__"));
  const devConfig = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    plugins: [
      MyparcelPlugin.init({
        "e2e-default-channel": process.env.MYPARCEL_APIKEY!
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
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);
  await server.init({
    initialData,
    productsCsvPath: "../test/src/products-import.csv",
    customerCount: 2
  });

  // Add a test-order at every server start
  await addShippingMethod(adminClient, "my-parcel");
  await shopClient.asUserWithCredentials("hayden.zieme12@hotmail.com", "test");
  await addItem(shopClient, "T_1", 1);
  await addItem(shopClient, "T_2", 2);
  await proceedToArrangingPayment(shopClient);
  await addPaymentToOrder(shopClient, testPaymentMethod.code);
})();
