import {
  EventBus,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { adminApiExtensions } from './api/api-extensions';
import { fullSyncPermission } from './config/permissions';
import { QlsAdminResolver } from './api/qls-admin.resolver';
import { QlsWebhooksController } from './api/qls-webhooks-controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { QlsOrderService } from './services/qls-order.service';
import { QlsProductService } from './services/qls-product.service';
import { QlsPluginOptions } from './types';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { variantCustomFields } from './custom-fields';

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
    config.authOptions.customPermissions.push(fullSyncPermission);
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

  constructor(
    private eventBus: EventBus,
    private qlsService: QlsProductService
  ) {}

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
