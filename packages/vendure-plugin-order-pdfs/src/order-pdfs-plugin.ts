import {
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { OrderPDFsService } from './api/order-pdfs.service';
import {
  PDFTemplateAdminResolver,
  pdfDownloadPermission,
} from './api/pdf-template-admin-resolver';
import { adminSchema, shopSchema } from './api/schema.graphql';
import { OrderPDFsController } from './api/order-pdfs.controller';
import { LoadDataFn, defaultLoadDataFn } from './load-data-fn';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PDFTemplateEntity } from './api/pdf-template.entity';
import { PDFTemplateShopResolver } from './api/pdf-template-shop-resolver';

export interface PDFTemplatePluginOptions {
  /**
   * Load custom data that is passed in to your HTML/handlebars template
   */
  loadDataFn?: LoadDataFn;
  /**
   * Allow public download of PDFs, requires the emailaddress that belongs to the order.
   * @example /pdf-templates/download/my-channel-token/1234/F1BTWG6U2JBXT1RC/hayden.zieme@hotmail.com
   */
  allowPublicDownload?: boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [PDFTemplateEntity],
  providers: [
    OrderPDFsService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => OrderPDFsPlugin.options,
    },
  ],
  controllers: [OrderPDFsController],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [PDFTemplateAdminResolver],
  },
  shopApiExtensions: {
    schema: shopSchema,
    resolvers: [PDFTemplateShopResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(pdfDownloadPermission);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class OrderPDFsPlugin {
  static options: PDFTemplatePluginOptions = {
    loadDataFn: defaultLoadDataFn,
  };

  static init(options: PDFTemplatePluginOptions): Type<OrderPDFsPlugin> {
    OrderPDFsPlugin.options = {
      ...this.options,
      ...options,
    };
    return OrderPDFsPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
    routes: [{ route: 'pdf-templates', filePath: 'routes.ts' }],
  };
}
