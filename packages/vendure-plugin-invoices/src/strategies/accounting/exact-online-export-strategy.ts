import { Injector, RequestContext, Order, ChannelService } from '@vendure/core';
import { InvoiceEntity } from '../../entities/invoice.entity';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';
import { ExactOnlineClient } from './exact-online-client';
import readline from 'readline';
import { INestApplication } from '@nestjs/common';

interface WithExactCustomField {
  exactRefreshToken?: string;
}

export interface ExactConfig {
  /**
   * When undefined, invoices for all channels will be synced to Exact
   */
  channelToken: string | undefined;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class ExactOnlineStrategy implements AccountingExportStrategy {
  readonly channelToken: string | undefined;
  readonly client: ExactOnlineClient;
  private injector!: Injector;

  constructor(private readonly config: ExactConfig) {
    this.channelToken = config.channelToken;
    this.client = new ExactOnlineClient(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  init(_injector: Injector) {
    this.injector = _injector;
  }

  exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> | ExternalReference {
    throw new Error('Method not implemented.');
  }

  exportCreditInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    isCreditInvoiceFor: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> | ExternalReference {
    throw new Error('Method not implemented.');
  }

  /**
   * Set up the refresh token for Exact Online Auth for the current channel.
   * Is idempotent: If a valid refresh token is already set, it will not be changed.
   * Intended for local use only, because it requires user interaction.
   *
   * See README for a guide on how to set up the Exact Online API credentials using this function.
   */
  async setupExactAuth(
    ctx: RequestContext,
    app: INestApplication<unknown>
  ): Promise<void> {
    // Wait for server startup
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // First check if a refresh token is already set on the channel
    // eslint-disable-next-line no-prototype-builtins
    if (
      !(ctx.channel.customFields as WithExactCustomField)?.hasOwnProperty(
        'exactRefreshToken'
      )
    ) {
      throw Error('Channel does not have the custom field "exactRefreshToken"');
    }
    const exactRefreshToken = (ctx.channel.customFields as WithExactCustomField)
      ?.exactRefreshToken;
    if (exactRefreshToken) {
      // Check if it is still valid
      const tokenSet = await this.client
        .refreshTokens(exactRefreshToken)
        .catch(() => {});
      if (tokenSet) {
        await app.get(ChannelService).update(ctx, {
          id: ctx.channel.id,
          customFields: {
            exactRefreshToken: tokenSet.refresh_token,
          },
        });
        console.log('Refresh token is already set and valid');
        return;
      }
    }
    // Otherwise, prompt user to log in via browser
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const loginUrl = this.client.getLoginUrl();
    const code: string = await new Promise((resolve, reject) => {
      rl.question(
        `Visit this URL in the browser, log in, and paste the entire redirect URL below. ${loginUrl} \n`,
        (urlInput) => {
          const code = urlInput.split('code=')[1];
          if (!code) {
            reject('No code found in the URL. Did you paste the entire URL?');
          }
          rl.close();
          resolve(code);
        }
      );
    });
    console.log(`Exchanging code for refresh token...`);
    const tokenSet = await this.client.getAccessToken(code);
    console.log(
      `Successfully received refreshToken for channel '${ctx.channel.token}'`
    );
    await app.get(ChannelService).update(ctx, {
      id: ctx.channel.id,
      customFields: {
        exactRefreshToken: tokenSet.refresh_token,
      },
    });
  }
}
