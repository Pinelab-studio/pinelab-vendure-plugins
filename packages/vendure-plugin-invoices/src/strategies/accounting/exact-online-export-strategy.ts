import { INestApplication } from '@nestjs/common';
import {
  Cache,
  CacheService,
  ChannelService,
  Injector,
  Logger,
  Order,
  RequestContext,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import readline from 'readline';
import { loggerCtx } from '../../constants';
import { InvoiceEntity } from '../../entities/invoice.entity';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';
import { ExactOnlineClient } from './exact-online-client';

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
  /**
   * the code of the diivision/administration to use. Can be found in the URL when logged in to Exact Online
   * E.g. `3870123`
   */
  division: number;
}

// Don't change this, it is used for log alerts.
const INVALID_REFRESH_TOKEN_ERROR =
  'No valid refresh token for Exact Online found';

export class ExactOnlineStrategy implements AccountingExportStrategy {
  readonly channelToken: string | undefined;
  readonly client: ExactOnlineClient;
  private injector!: Injector;
  private accessTokenCache!: Cache;

  constructor(private readonly config: ExactConfig) {
    this.channelToken = config.channelToken;
    this.client = new ExactOnlineClient(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
      config.division
    );
  }

  init(_injector: Injector) {
    this.injector = _injector;
    this.accessTokenCache = this.injector.get(CacheService).createCache({
      getKey: (id) => `ExactOnlineAccessToken:${id}`,
      options: {
        ttl: 9.5 * 1000 * 60, // 9 minutes 30 seconds, as described in the Exact Docs
      },
    });
  }

  async exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> {
    const accessToken = await this.getAccessToken(ctx);
    Logger.debug(
      `Fetching customer ${
        order.customer?.emailAddress
      } with accessToken '...${accessToken.slice(0, 5)}'`,
      loggerCtx
    );
    const customerId = await this.client.getCustomerId(
      accessToken,
      'order.customer.emailAddress'
    );
    Logger.debug(
      `Found customer '${customerId}' in exact for ${order.customer?.emailAddress}`,
      loggerCtx
    );
    return {} as any;
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
   * Get access token from cache. If not present, get a new one using the refresh token and store in cache.
   * If forceRenewal is true, get a new access token using the refresh token and store in cache.
   *
   * If a new access token is requested, it also stores the latest refresh token on the channel
   */
  private async getAccessToken(
    ctx: RequestContext,
    forceRenewal = false
  ): Promise<string> {
    const refreshToken = (ctx.channel.customFields as WithExactCustomField)
      ?.exactRefreshToken;
    if (!refreshToken) {
      throw new Error(
        `${INVALID_REFRESH_TOKEN_ERROR}: No refresh token set on channel '${ctx.channel.token}'`
      );
    }
    if (forceRenewal) {
      await this.accessTokenCache.delete(ctx.channel.id);
    }
    return await this.accessTokenCache.get(ctx.channel.id, async () => {
      // This is executed when no access token is found in the cache
      Logger.debug(
        `Getting new access token for channel '${
          ctx.channel.token
        }' with refresh token '...${refreshToken.slice(-4)}'`,
        loggerCtx
      );
      const tokenSet = await this.client
        .renewTokens(refreshToken)
        .catch((e) => {
          const error = asError(e);
          Logger.error(
            `${INVALID_REFRESH_TOKEN_ERROR}: Error getting new access token from Exact'${error.message}`,
            loggerCtx,
            error.message
          );
          throw e;
        });
      // Save the new refresh token on the channel
      await this.injector.get(ChannelService).update(ctx, {
        id: ctx.channel.id,
        customFields: {
          exactRefreshToken: tokenSet.refresh_token,
        },
      });
      return tokenSet.access_token;
    });
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
    const customFields = ctx.channel.customFields as WithExactCustomField;
    // First check if a refresh token is already set on the channel
    if (
      // eslint-disable-next-line no-prototype-builtins
      !customFields?.hasOwnProperty('exactRefreshToken') ||
      // eslint-disable-next-line no-prototype-builtins
      !customFields?.hasOwnProperty('exactAccessToken')
    ) {
      throw Error(
        'Channel custom fields should have "exactRefreshToken" and "exactAccessToken"'
      );
    }
    const exactRefreshToken = (ctx.channel.customFields as WithExactCustomField)
      ?.exactRefreshToken;
    if (exactRefreshToken) {
      console.log('A refresh token is already set, checking validity...');
      // Check if it is still valid
      const tokenSet = await this.client
        .renewTokens(exactRefreshToken)
        .catch((e) => {
          console.log(`Refresh token is invalid: ${asError(e).message}`);
        });
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
      `Successfully saved refresh token '...${tokenSet.refresh_token.slice(
        -4
      )}' for channel '${ctx.channel.token}'`
    );
    await app.get(ChannelService).update(ctx, {
      id: ctx.channel.id,
      customFields: {
        exactRefreshToken: tokenSet.refresh_token,
      },
    });
    // JSUT TESTING
    const res = await this.client.getCustomerId(
      tokenSet.access_token,
      'order.customer.emailAddress'
    );
    console.log(res);
  }
}
