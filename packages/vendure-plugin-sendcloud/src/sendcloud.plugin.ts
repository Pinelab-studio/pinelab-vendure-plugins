import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { SendcloudPluginOptions } from './api/types/sendcloud.types';
import {
  SendcloudResolver,
  sendcloudPermission,
} from './api/sendcloud.resolver';
import { SendcloudService } from './api/sendcloud.service';
import { PLUGIN_OPTIONS } from './api/constants';
import { SendcloudController } from './api/sendcloud.controller';
import { SendcloudConfigEntity } from './api/sendcloud-config.entity';
import { sendcloudHandler } from './api/sendcloud.handler';

@VendurePlugin({
  adminApiExtensions: {
    schema: gql`
      extend enum HistoryEntryType {
        SENDCLOUD_NOTIFICATION
      }
      type SendCloudConfig {
        id: ID!
        secret: String
        publicKey: String
        defaultPhoneNr: String
      }
      input SendCloudConfigInput {
        secret: String
        publicKey: String
        defaultPhoneNr: String
      }
      extend type Mutation {
        sendToSendCloud(orderId: ID!): Boolean!
        updateSendCloudConfig(input: SendCloudConfigInput): SendCloudConfig!
      }
      extend type Query {
        sendCloudConfig: SendCloudConfig
      }
    `,
    resolvers: [SendcloudResolver],
  },
  providers: [
    SendcloudService,
    {
      provide: PLUGIN_OPTIONS,
      useFactory: () => SendcloudPlugin.options,
    },
  ],
  imports: [PluginCommonModule],
  controllers: [SendcloudController],
  entities: [SendcloudConfigEntity],
  configuration: (config) => {
    config.shippingOptions.fulfillmentHandlers.push(sendcloudHandler);
    config.authOptions.customPermissions.push(sendcloudPermission);
    return config;
  },
  compatibility: '^2.0.0',
})
export class SendcloudPlugin {
  private static options: SendcloudPluginOptions;

  static init(options: SendcloudPluginOptions): typeof SendcloudPlugin {
    this.options = options;
    return SendcloudPlugin;
  }

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'sendcloud',
        ngModuleFileName: 'sendcloud.module.ts',
        ngModuleName: 'SendcloudModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'sendcloud-nav.module.ts',
        ngModuleName: 'SendcloudNavModule',
      },
    ],
  };
}
