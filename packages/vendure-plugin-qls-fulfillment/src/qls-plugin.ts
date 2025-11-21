import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { adminApiExtensions } from './api/api-extensions';
import { QlsAdminResolver } from './api/qls-admin.resolver';
import { QlsWebhooksController } from './api/qls-webhooks-controller';
import {
  qlsFullSyncPermission,
  qlsPushOrderPermission,
} from './config/permissions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { variantCustomFields } from './custom-fields';
import { QlsOrderService } from './services/qls-order.service';
import { QlsProductService } from './services/qls-product.service';
import { QlsPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
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
    config.customFields.ProductVariant.push(...variantCustomFields);
    return config;
  },
  compatibility: '>=3.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [QlsAdminResolver],
  },
})
export class QlsPlugin {
  static options: QlsPluginOptions;

  static init(options: QlsPluginOptions): Type<QlsPlugin> {
    this.options = options;
    return QlsPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    id: 'qls-fulfillment-ui',
    providers: ['providers.ts'],
  };
}
