import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
    DefaultLogger,
    DefaultSearchPlugin,
    LogLevel,
    mergeConfig
} from '@vendure/core';
import {
    createTestEnvironment,
    registerInitializer, SqljsInitializer
} from '@vendure/testing';
import path from 'path';
import { addShippingMethod } from '../../test/src/admin-utils';
import { initialData } from '../../test/src/initial-data';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { KlaviyoPlugin } from '../src';

(async () => {
    require('dotenv').config();
    const { testConfig } = require('@vendure/testing');
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
        logger: new DefaultLogger({ level: LogLevel.Debug }),
        apiOptions: {
            adminApiPlayground: {},
            shopApiPlayground: {},
        },
        paymentOptions: {
            paymentMethodHandlers: [testPaymentMethod],
        },
        plugins: [
            KlaviyoPlugin.init({
                apiKey: process.env.KLAVIYO_PRIVATE_API_KEY!,
            }),
            AssetServerPlugin.init({
                assetUploadDir: path.join(__dirname, '../__data__/assets'),
                route: 'assets',
            }),
            DefaultSearchPlugin,
            AdminUiPlugin.init({
                port: 3002,
                route: 'admin',
            }),
        ],
    });
    const { server, shopClient, adminClient } = createTestEnvironment(config);
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
    });
    const order = await createSettledOrder(shopClient, 1);
    console.log(`Created settled order '${order.code}'`);
})();
