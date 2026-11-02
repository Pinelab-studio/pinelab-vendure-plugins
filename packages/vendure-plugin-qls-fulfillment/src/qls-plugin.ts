import { PluginCommonModule, type Type, VendurePlugin } from '@vendure/core';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { QlsAdminResolver } from './api/qls-admin.resolver';
import { QlsShopResolver } from './api/qls-shop.resolver';
import { QlsWebhooksController } from './api/qls-webhooks-controller';
import {
  qlsFullSyncPermission,
  qlsPushOrderPermission,
} from './config/permissions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { getVariantCustomFields, orderCustomFields } from './custom-fields';
import { QlsOrderEntity } from './entities/qls-order-entity.entity';
import { QlsOrderService } from './services/qls-order.service';
import { QlsProductService } from './services/qls-product.service';
import type { QlsPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  dashboard: './dashboard/index.tsx',
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => QlsPlugin.options,
    },
    QlsProductService,
    QlsOrderService,
  ],
  controllers: [QlsWebhooksController],
  configuration: (config) => {
    config.authOptions.customPermissions.push(qlsFullSyncPermission);
    config.authOptions.customPermissions.push(qlsPushOrderPermission);
    config.customFields.ProductVariant.push(
      ...getVariantCustomFields(
        QlsPlugin.options?.productSync?.qlsProductIdUiTab,
      ),
    );
    config.customFields.Order.push(...orderCustomFields);
    return config;
  },
  compatibility: '>=3.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [QlsAdminResolver],
  },
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [QlsShopResolver],
  },
  entities: [QlsOrderEntity],
})
export class QlsPlugin {
  static options: QlsPluginOptions;

  static init(options: QlsPluginOptions): Type<QlsPlugin> {
    QlsPlugin.options = {
      ...options,
      orderSync: {
        autoPushOrders: true,
        ...options.orderSync,
      },
      productSync: {
        synchronizeStockLevels: true,
        qlsProductIdUiTab: 'QLS',
        ...options.productSync,
      },
    };
    return QlsPlugin;
  }
}
