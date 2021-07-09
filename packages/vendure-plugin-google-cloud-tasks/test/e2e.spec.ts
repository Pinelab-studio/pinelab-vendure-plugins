/* tslint:disable:no-non-null-assertion */
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from "@vendure/testing";
import gql from "graphql-tag";
import { DefaultLogger, LogLevel } from "@vendure/core";
import * as path from "path";
import { GoogleStorageStrategy } from "../src/google-storage-strategy";
import { initialData } from "../../dev-server/script/initialData";

describe("ChannelAware Assets", () => {
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  registerInitializer("sqljs", new SqljsInitializer("__data__"));
  testConfig.plugins.push(GoogleStorageStrategy);
  const { server, adminClient, shopClient } = createTestEnvironment(devConfig);

  beforeAll(async () => {
    await server.init({
      initialData,
      productsCsvPath: "../test/products-import.csv",
    });
  }, 1800 * 1000);

  afterAll(async () => {
    await server.destroy();
  });

  it("Test", async () => {
    const ding = await shopClient.query(
      gql`
        {
          products {
            items {
              id
            }
          }
        }
      `
    );
    console.log(ding);
    expect(ding).toBeDefined();
  });
});
