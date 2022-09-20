import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { INestApplication } from '@nestjs/common';
import { SendcloudService } from './sendcloud.service';
import { SendcloudOptions } from './types/sendcloud-options';
import { SendcloudController } from './sendcloud.controller';
import { SendcloudClient } from './sendcloud.client';
import { json } from 'body-parser';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PLUGIN_OPTIONS } from './constants';
import { gql } from 'apollo-server-core';
import { SendcloudResolver } from './sendcloud.resolver';

const cloneBuffer = require('clone-buffer');

@VendurePlugin({
  adminApiExtensions: {
    schema: gql`
      extend type Mutation {
        sendToSendcloud(orderId: ID!): Boolean!
      }
    `,
    resolvers: [SendcloudResolver],
  },
  providers: [
    SendcloudService,
    {
      useFactory: () => SendcloudPlugin.options,
      provide: PLUGIN_OPTIONS,
    },
  ],
  imports: [PluginCommonModule],
  controllers: [SendcloudController],
})
export class SendcloudPlugin {
  private static options: SendcloudOptions;

  static init(options: SendcloudOptions): typeof SendcloudPlugin {
    this.options = options;
    return SendcloudPlugin;
  }

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
}
