import { PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { SendcloudPluginOptions } from './api/types/sendcloud.types';
import { SendcloudResolver } from './api/sendcloud.resolver';
import { SendcloudService } from './api/sendcloud.service';
import { PLUGIN_OPTIONS } from './api/constants';
import { sendcloudHandler } from './api/sendcloud.handler';
import { channelCustomFields, sendcloudPermission } from './custom-fields';

@VendurePlugin({
  adminApiExtensions: {
    schema: gql`
      extend type Mutation {
        sendToSendCloud(orderId: ID!): Boolean!
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
  configuration: (config: RuntimeVendureConfig) => {
    config.shippingOptions.fulfillmentHandlers.push(sendcloudHandler);
    config.authOptions.customPermissions.push(sendcloudPermission);
    config.customFields.Channel.push(...channelCustomFields);
    return config;
  },
  compatibility: '>=3.1.0',
})
export class SendcloudPlugin {
  private static options: SendcloudPluginOptions;

  static init(options: SendcloudPluginOptions): typeof SendcloudPlugin {
    this.options = options;
    return SendcloudPlugin;
  }
}
