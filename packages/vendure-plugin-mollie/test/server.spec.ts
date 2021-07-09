import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from "@vendure/testing";
import { initialData } from "../../test/initialData";
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from "@vendure/core";
import { MolliePlugin } from "../src";
import { TestServer } from "@vendure/testing/lib/test-server";

jest.setTimeout(20000);

describe("Mollie plugin", function () {
  let testServer: TestServer;

  it("Server should start", async () => {
    registerInitializer("sqljs", new SqljsInitializer("__data__"));

    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3103,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [MolliePlugin],
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
