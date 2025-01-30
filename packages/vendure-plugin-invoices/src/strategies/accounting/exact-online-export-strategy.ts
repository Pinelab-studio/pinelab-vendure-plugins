import { INestApplication } from '@nestjs/common';
import {
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
import { TokenSet } from './exact-online-client';

interface WithExactCustomFields {
  /**
   * Token to get new access tokens from Exact. Valid for 30 days.
   * When receivind a new access token, the refresh token is also updated.
   */
  exactRefreshToken?: string;
  /**
   * Temporarily lived acces token: valid for 10 minutes
   */
  exactAccessToken?: string;
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
  private channelService!: ChannelService;

  constructor(private readonly config: ExactConfig) {
    this.channelToken = config.channelToken;
    this.client = new ExactOnlineClient(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
      config.division
    );
  }

  init(injector: Injector) {
    this.channelService = injector.get(ChannelService);
  }

  async exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> {
    const accessToken = await this.getAccessToken(ctx);
    const customerId = await this.client.getCustomerId(
      accessToken,
      // order.customer.emailAddress
      'martijn@pinelab.studio'
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
  async getAccessToken(ctx: RequestContext): Promise<string> {
    const { exactAccessToken, exactRefreshToken } = ctx.channel
      .customFields as WithExactCustomFields;
    if (!exactRefreshToken) {
      throw new Error(
        `${INVALID_REFRESH_TOKEN_ERROR}: No refresh token set on channel '${ctx.channel.token}'`
      );
    }
    if (await this.client.isAccessTokenValid(exactAccessToken)) {
      return exactAccessToken!;
    }
    return '';
    // const tokenSet = await this.client.renewTokens(exactRefreshToken);
    // await this.saveTokens(ctx, this.channelService, tokenSet);
    // return tokenSet.access_token;
  }

  private async saveTokens(
    ctx: RequestContext,
    channelService: ChannelService,
    tokenSet: TokenSet
  ): Promise<void> {
    await channelService.update(ctx, {
      id: ctx.channel.id,
      customFields: {
        exactRefreshToken: tokenSet.refresh_token,
        exactAccessToken: tokenSet.access_token,
      },
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
    const customFields = ctx.channel.customFields as WithExactCustomFields;
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
    const exactRefreshToken = (
      ctx.channel.customFields as WithExactCustomFields
    )?.exactRefreshToken;
    if (exactRefreshToken) {
      console.log('A refresh token is already set, checking validity...');
      // Check if it is still valid
      const tokenSet = await this.client
        .renewTokens(exactRefreshToken)
        .catch((e) => {
          console.log(`Refresh token is invalid: ${asError(e).message}`);
        });
      if (tokenSet) {
        await this.saveTokens(ctx, app.get(ChannelService), tokenSet);
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
    await this.saveTokens(ctx, app.get(ChannelService), tokenSet);
    console.log(
      `Successfully saved refresh token for channel '${ctx.channel.token}'`
    );

    // FIXME
    await this.getAccessToken(ctx);
  }
}
