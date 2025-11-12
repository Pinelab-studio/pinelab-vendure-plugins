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
        case 'updated':
          void this.qlsService.triggerSyncProducts(
            event.ctx,
            event.entity.map((variant) => variant.id)
          );
          break;
      }
    });
  }
}
