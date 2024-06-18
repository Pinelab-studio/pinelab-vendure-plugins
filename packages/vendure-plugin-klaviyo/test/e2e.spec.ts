import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer, testConfig, TestServer } from '@vendure/testing';
import { EventCreateQueryV2 } from 'klaviyo-api';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { KlaviyoPlugin } from '../src';

let server: TestServer;
let adminClient: SimpleGraphQLClient;
let shopClient: SimpleGraphQLClient;

beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
        logger: new DefaultLogger({ level: LogLevel.Debug }),
        plugins: [
            KlaviyoPlugin.init({
                apiKey: 'some_private_api_key'
            })
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
    await adminClient.asSuperAdmin();
}, 30000);

afterAll(async () => {
    await server.destroy();
}, 100000);

// Clear nock mocks after each test
afterEach(() => nock.cleanAll());

describe("Klaviyo", () => {

    // Intercepted requests to Klaviyo
    const klaviyoRequests: EventCreateQueryV2[] = [];

    it("Started the server", () => {
        expect(server.app.getHttpServer()).toBeDefined();
    });

    it("Places an order", async () => {
        nock("https://a.klaviyo.com/api/")
            .post("/events/", (reqBody) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                klaviyoRequests.push(reqBody);
                return true;
            })
            .reply(200, {})
            .persist();
        const order = await createSettledOrder(shopClient, 1);
        // Give worker some time to send event to klaviyo
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(order.code).toBeDefined();
    });

    it("Has sent 'Placed Order Event' to Klaviyo", () => {
        const orderEvent = klaviyoRequests.find(
            (r) => r.data.attributes.metric.data.attributes.name === "Placed Order",
        );
        const attributes = orderEvent?.data.attributes as any;
        expect(attributes.properties.OrderId).toBeDefined();
        expect(attributes.properties.ItemNames).toEqual([
            "Laptop 13 inch 8GB",
            "Laptop 15 inch 8GB"
        ]);
        const time = new Date(attributes.time!).getTime();
        expect(isNaN(time)).toBe(false); // Should be valid date
        expect(attributes?.value).toBe(4921.4);
        expect(attributes?.unique_id).toBeDefined();
        const orderItem = (orderEvent?.data.attributes.properties as any)
            .Items[0];
        expect(orderItem.ProductID).toBeDefined();
        expect(orderItem.SKU).toBe("L2201308");
        expect(orderItem.ProductName).toBe("Laptop 13 inch 8GB");
        expect(orderItem.Quantity).toBe(1);
        expect(orderItem.ItemPrice).toBe(1558.8);
        expect(orderItem.RowTotal).toBe(1558.8);
        const profile = orderEvent?.data.attributes.profile.data
            .attributes as any;
        expect(profile.email).toBe("hayden.zieme12@hotmail.com");
        expect(profile.external_id).toBe("1");
        expect(profile.first_name).toBe("Hayden");
        expect(profile.last_name).toBe("Zieme");
        expect(profile.location.address1).toBe("Verzetsstraat");
        expect(profile.location.address2).toBe("12a");
        expect(profile.location.city).toBe("Liwwa");
        expect(profile.location.country).toBe("NL");
    });
});