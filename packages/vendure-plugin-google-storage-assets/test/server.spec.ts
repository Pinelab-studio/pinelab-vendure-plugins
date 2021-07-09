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
import { TestServer } from "@vendure/testing/lib/test-server";
import { AssetServerPlugin } from "@vendure/asset-server-plugin";
import { GoogleStorageStrategy } from "../src";
import { GoogleStoragePlugin } from "../dist";

jest.setTimeout(20000);
describe("Google Storage Assets plugin", () => {
  let testServer: TestServer;

  it("Server should start", async () => {
    registerInitializer("sqljs", new SqljsInitializer("__data__"));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3102,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        AssetServerPlugin.init({
          storageStrategyFactory: () =>
            new GoogleStorageStrategy({
              bucketName: "testBucket",
            }),
          route: "assets",
          assetUploadDir: "/tmp/vendure/assets",
        }),
        GoogleStoragePlugin,
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
