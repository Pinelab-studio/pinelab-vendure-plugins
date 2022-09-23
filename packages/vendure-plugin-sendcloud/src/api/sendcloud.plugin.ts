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

interface Input {
  additionalParcelInputFn: AdditionalParcelInputFn;
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
  providers: [SendcloudService],
  imports: [PluginCommonModule],
  controllers: [SendcloudController],
})
export class SendcloudPlugin {
  static options: Input;

  static init(input: Input): typeof SendcloudPlugin {
    this.options = input;
    return SendcloudPlugin;
  }

  // FIXME this van be done in a cleaner manner
  static beforeVendureBootstrap(app: INestApplication): void | Promise<void> {
    // Save raw body for signature verification
    app.use(
      json({
        verify: (req: any, res, buf, encoding) => {
          if (
            req.headers[SendcloudClient.signatureHeader] &&
            Buffer.isBuffer(buf)
          ) {
            req.rawBody = cloneBuffer(buf);
          }
          return true;
        },
      })
    );
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
