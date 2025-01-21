import {
  PluginCommonModule,
  RuntimeVendureConfig,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PDFTemplateService } from './api/pdf-template.service';
import {
  PDFTemplateResolver,
  pdfDownloadPermission,
} from './api/pdf-template.resolver';
import { schema } from './api/schema.graphql';
import { PDFTemplateController } from './api/pdf-template.controller';
import { LoadDataFn, defaultLoadDataFn } from './load-data-fn';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PDFTemplateEntity } from './api/pdf-template.entity';

export interface PDFTemplatePluginOptions {
  /**
   * Load custom data that is passed in to your HTML/handlebars template
   */
  loadDataFn?: LoadDataFn;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [PDFTemplateEntity],
  providers: [
    PDFTemplateService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => PDFTemplatePlugin.options,
    },
  ],
  controllers: [PDFTemplateController],
  adminApiExtensions: {
    schema: schema as any,
    resolvers: [PDFTemplateResolver],
  },
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(pdfDownloadPermission);
    return config;
  },
  compatibility: '>=3.1.0',
})
export class PDFTemplatePlugin {
  static options: PDFTemplatePluginOptions = {
    loadDataFn: defaultLoadDataFn,
  };

  static init(options: PDFTemplatePluginOptions): Type<PDFTemplatePlugin> {
    PDFTemplatePlugin.options = {
      ...this.options,
      ...options,
    };
    return PDFTemplatePlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
    routes: [{ route: 'pdf-templates', filePath: 'routes.ts' }],
  };
}
