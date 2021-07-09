import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from "@vendure/testing";
import { InitialData, DefaultSearchPlugin } from "@vendure/core";
import { initialData } from "../../test/initialData";
import { AdminUiPlugin } from "@vendure/admin-ui-plugin";
import ngrok from "ngrok";

(async () => {
  registerInitializer("sqljs", new SqljsInitializer("__data__"));
  process.env.PUBLIC_VENDURE_URL = await ngrok.connect(3050);
  const { devConfig } = require("./dev-config");
  const { server } = createTestEnvironment(devConfig);
  devConfig.plugins.push(AdminUiPlugin.init({ route: "admin", port: 3002 }));
  devConfig.plugins.push(DefaultSearchPlugin);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: "../test/products-import.csv",
  });
})();
