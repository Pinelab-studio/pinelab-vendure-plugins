import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from "@vendure/testing";
import { initialData } from "../../test/initialData";
import {
  CollectionModificationEvent,
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
  ProductEvent,
  ProductVariantChannelEvent,
  ProductVariantEvent,
} from "@vendure/core";
import { WebhookPlugin } from "../src";
import { TestServer } from "@vendure/testing/lib/test-server";

jest.setTimeout(20000);

describe("Mollie plugin", function () {
  let testServer: TestServer;

  it("Server should start", async () => {
    registerInitializer("sqljs", new SqljsInitializer("__data__"));

    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3104,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        WebhookPlugin.init({
          httpMethod: "POST",
          delay: 3000,
          events: [
            ProductEvent,
            ProductVariantChannelEvent,
            ProductVariantEvent,
            CollectionModificationEvent,
          ],
        }),
      ],
    });

    const { server } = createTestEnvironment(config);
    testServer = server;
    const serverStart = server.init({
      initialData: initialData as InitialData,
      productsCsvPath: "../test/products-import.csv",
    });
    await expect(serverStart).resolves.toEqual(undefined);
  });

  afterAll(() => {
    return testServer.destroy();
  });
});
