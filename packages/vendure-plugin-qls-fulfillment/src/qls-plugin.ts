import { OnModuleInit } from '@nestjs/common';
import {
  EventBus,
  PluginCommonModule,
  ProductVariantEvent,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { adminApiExtensions } from './api/api-extensions';
import { fullSyncPermission } from './api/permissions';
import { QlsAdminResolver } from './api/qls-admin.resolver';
import { QlsWebhooksController } from './api/qls-webhooks-controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { customProductVariantFields } from './custom-fields';
import { QlsProductService } from './services/qls-product-service';
import { QlsPluginOptions } from './types';
import { QlsOrderService } from './services/qls-order.service';

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
    config.customFields.ProductVariant.push(...customProductVariantFields);
    config.authOptions.customPermissions.push(fullSyncPermission);
    return config;
  },
  compatibility: '>=3.2.0',
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [QlsAdminResolver],
  },
})
export class QlsPlugin implements OnModuleInit {
  static options: QlsPluginOptions;

  constructor(
    private eventBus: EventBus,
    private qlsService: QlsProductService
  ) {}

  static init(options: QlsPluginOptions): Type<QlsPlugin> {
    this.options = options;
    return QlsPlugin;
  }

  onModuleInit() {
    this.eventBus.ofType(ProductVariantEvent).subscribe((event) => {
      switch (event.type) {
        case 'created':
          void this.qlsService.triggerCreateFulfillmentProducts(
            event.ctx,
            event.entity.map((variant) => variant.id)
          );
          break;
        case 'updated':
          void this.qlsService.triggerUpdateFulfillmentProducts(
            event.ctx,
            event.entity.map((variant) => variant.id)
          );
          break;
      }
    });
  }
}
