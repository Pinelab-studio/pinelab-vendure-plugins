import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from "@vendure/testing";
import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
  mergeConfig,
  ShippingMethodService,
  TransactionalConnection
} from "@vendure/core";
import { initialData } from "../../test/src/initial-data";
import { createSettledOrder } from "../../test/src/order-utils";
import { EBoekhoudenPlugin } from "../src";
import { AdminUiPlugin } from "@vendure/admin-ui-plugin";
import path from "path";
import { compileUiExtensions } from "@vendure/ui-devkit/compiler";

(async () => {
  registerInitializer("sqljs", new SqljsInitializer("__data__"));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {}
    },
    plugins: [
      EBoekhoudenPlugin,
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: "admin",
        app: compileUiExtensions({
          outputPath: path.join(__dirname, "__admin-ui"),
          extensions: [EBoekhoudenPlugin.ui],
          devMode: true
        })
      })
    ]
  });
  const { server } = createTestEnvironment(config);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: "../test/src/products-import.csv"
  });
})();
