import { Middleware, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { SendcloudService } from './sendcloud.service';
import { SendcloudController } from './sendcloud.controller';
import { gql } from 'apollo-server-core';
import { SendcloudResolver } from './sendcloud.resolver';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { AdditionalParcelInputFn } from './types/sendcloud.types';
import { PLUGIN_OPTIONS } from './constants';
import { sendcloudHandler } from './sendcloud.handler';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { sendcloudPermission } from '../index';
import bodyParser from 'body-parser';

export interface SendcloudPluginOptions {
  /**
   * You can send additional ParcelItems (rows) to SendCloud.
   * For example if you want the couponCodes applied also on your
   * packaging slip in SendCloud
   */
  additionalParcelItemsFn?: AdditionalParcelInputFn;
}

export const sendcloudMiddleware: Middleware = {
  route: '/sendcloud/webhook/e2e-default-channel',
  beforeListen: true,
  handler: bodyParser.json({
    verify(req, _, buf) {
      if (Buffer.isBuffer(buf)) {
        (req as any).rawBody = Buffer.from(buf);
      }
      return true;
    },
  }),
};

@VendurePlugin({
  adminApiExtensions: {
    schema: gql`
      type SendCloudConfig {
        id: ID!
        secret: String
        publicKey: String
      }
      input SendCloudConfigInput {
        secret: String
        publicKey: String
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
    // save rawBody for signature verification
    config.apiOptions.middleware.push(sendcloudMiddleware);
    return config;
  },
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
