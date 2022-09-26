import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { INestApplication } from '@nestjs/common';
import { SendcloudService } from './sendcloud.service';
import { SendcloudController } from './sendcloud.controller';
import { SendcloudClient } from './sendcloud.client';
import { json } from 'body-parser';
import { gql } from 'apollo-server-core';
import { SendcloudResolver } from './sendcloud.resolver';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { AdditionalParcelInputFn } from './types/sendcloud.types';
import { PLUGIN_OPTIONS } from './constants';
import { sendcloudHandler } from './sendcloud.handler';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { sendcloudPermission } from '../index';

export interface SendcloudPluginOptions {
  additionalParcelItemsFn?: AdditionalParcelInputFn;
}

const cloneBuffer = require('clone-buffer');

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
    config.apiOptions.middleware.push({
      route: `/sendcloud*`,
      beforeListen: true,
      handler: json({
        verify: (req: any, res, buf, encoding) => {
          if (
            req.headers[SendcloudClient.signatureHeader] &&
            Buffer.isBuffer(buf)
          ) {
            req.rawBody = cloneBuffer(buf);
          }
          return true;
        },
      }),
    });
    return config;
  },
})
export class SendcloudPlugin {
  private static options: SendcloudPluginOptions;

  static init(input: SendcloudPluginOptions): typeof SendcloudPlugin {
    this.options = input;
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
