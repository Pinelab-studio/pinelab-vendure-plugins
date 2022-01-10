import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from "@vendure/testing";
import { initialData } from "../../test/src/initial-data";
import { DefaultLogger, InitialData, LogLevel, mergeConfig, ProductVariantService } from "@vendure/core";
import { TestServer } from "@vendure/testing/lib/test-server";
import { GoedgepicktPlugin } from "../src/goedgepickt.plugin";
import nock from "nock";
import { GoedgepicktService } from "../src/goedgepickt.service";

jest.setTimeout(20000);

describe("Goedgepickt plugin", function() {
  let server: TestServer;
  let serverStarted = false;

  let pushProductsPayloads: any[] = [];
  const apiUrl = "https://account.goedgepickt.nl/"
  // Update products
  nock(apiUrl)
    .persist(true)
    .post("/api/v1/products", (reqBody) => {
      pushProductsPayloads.push(reqBody);
      return true;
    })
    .reply(200, [])
  // Get products first
  nock(apiUrl)
    .get("/api/v1/products")
    .query(true)
    .reply(200, {
      "items": [
        {
          "sku": "L2201308",
          "stock": {
            "freeStock": 33
          }
        }]
    });
  // Get products second
  nock(apiUrl)
    .get("/api/v1/products")
    .query(true)
    .reply(200, {
      "items": []
    });


  beforeAll(async () => {
    registerInitializer("sqljs", new SqljsInitializer("__data__"));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        adminListQueryLimit: 10000,
        port: 3105
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [
        GoedgepicktPlugin.init({
          vendureHost: "https://testVendureHost",
          configPerChannel: [{
            channelToken: "e2e-default-channel",
            apiKey: "testApiKey",
            webshopUuid: "testWebshopUuid"
          }]
        })
      ]
    });

    ({ server } = createTestEnvironment(config));
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: "../test/src/products-import.csv"
    });
    serverStarted = true;
  }, 60000);

  it("Should start successfully", async () => {
    await expect(serverStarted).toBe(true);
  });

  it("Pushes all products", async () => {
    await server.app.get(GoedgepicktService).pushProducts("e2e-default-channel");
    await expect(pushProductsPayloads.length).toBe(4);
    const laptopPayload = pushProductsPayloads.find(p => p.sku === "L2201516");
    await expect(laptopPayload.webshopUuid).toBe("testWebshopUuid");
    await expect(laptopPayload.productId).toBe("L2201516");
    await expect(laptopPayload.sku).toBe("L2201516");
  });

  it("Pulls and updates stockLevels", async () => {
    await server.app.get(GoedgepicktService).pullStocklevels("e2e-default-channel");
    const ctx = await server.app.get(GoedgepicktService).getCtxForChannel("e2e-default-channel");
    const result = await server.app.get(ProductVariantService).findAll(ctx );
    const updatedVariant = result.items.find(variant => variant.sku === 'L2201308');
    await expect(updatedVariant?.stockOnHand).toBe(33);
  });

  afterAll(() => {
    return server.destroy();
  });
});
