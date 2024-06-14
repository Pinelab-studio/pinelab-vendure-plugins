import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  createSelfRefreshingCache,
  EventBus,
  GlobalSettingsEvent,
  GlobalSettingsService,
  ID,
  Injector,
  Logger,
  RequestContext,
  SelfRefreshingCache,
  TransactionalConnection,
} from '@vendure/core';
import { Webhook } from './webhook.entity';
import fetch, { HeadersInit } from 'node-fetch';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { EventWithContext, RequestTransformer } from './request-transformer';
import { WebhookPluginOptions } from '../webhook.plugin';
import { WebhookInput } from '../generated/graphql-types';

/**
 * Service for updating and retrieving webhooks from db
 */
@Injectable()
export class WebhookService implements OnApplicationBootstrap {
  /**
   * A queue of unique webhooks to call. This is used to prevent
   * multiple calls to the same webhook for the same
   * event within the configured `delay` time
   */
  webhookQueue = new Map<ID, Webhook>();

  private webhookToken!: SelfRefreshingCache<
    string | undefined,
    [RequestContext]
  >;

  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private globalSettingsService: GlobalSettingsService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS) private options: WebhookPluginOptions
  ) {}

  /**
   * Subscribe to events specified in config
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.options.events || this.options.events.length === 0) {
      throw Error(
        `Please specify VendureEvents with Webhook.init() to use this plugin.`
      );
    }
    if (this.options.disabled) {
      Logger.info(
        `Webhook plugin disabled,not listening for events`,
        loggerCtx
      );
      return;
    }
    // Subscribe to all configured events
    this.options.events.forEach((configuredEvent) => {
      this.eventBus.ofType(configuredEvent).subscribe(async (event) => {
        try {
          await this.addWebhookToQueue(event);
          // Start processing after the given delay, because
          // we might get multiple of the same events within the specified delay
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.delay)
          );
          await this.processQueue(event);
        } catch (e: unknown) {
          Logger.error(
            `Failed to call webhook for event ${event.constructor.name} for channel ${event.ctx.channelId}: ${e}`,
            loggerCtx
          );
        }
      });
      Logger.info(`Listening for ${configuredEvent.name}`, loggerCtx);
    });

    // Cache webhook token
    this.webhookToken = await createSelfRefreshingCache({
      name: 'Webhook Token',
      ttl: 60 * 60 * 24, // daily refresh
      refresh: {
        fn: (ctx) => {
          Logger.debug('Refreshing webhook token', loggerCtx);
          return this.globalSettingsService
            .getSettings(ctx)
            .then((settings) => {
              return 'webhookToken' in settings.customFields
                ? settings.customFields.webhookToken?.toString()
                : undefined;
            });
        },
        defaultArgs: [RequestContext.empty()],
      },
    });

    // Refresh token cache on settings update
    this.eventBus.ofType(GlobalSettingsEvent).subscribe((event) => {
      if (event.type === 'updated') {
        this.webhookToken.refresh(event.ctx);
      }
    });
  }

  /**
   * Get the plugin's configured Events.
   */
  getAvailableEvents(): string[] {
    return this.options.events.map((eventType) => eventType.name);
  }

  /**
   * Get the plugin's configured Request Transformers.
   */
  getAvailableTransformers(): RequestTransformer<any>[] {
    return this.options.requestTransformers || [];
  }

  /**
   * Get all configured webhooks for current channel
   */
  async getAllWebhooks(ctx: RequestContext): Promise<Webhook[]> {
    return this.connection
      .getRepository(ctx, Webhook)
      .find({ where: { channelId: String(ctx.channelId) } });
  }

  /**
   * Get configured webhooks for given Event
   */
  async getWebhooksForEvent<T extends EventWithContext>(
    event: T
  ): Promise<Webhook[]> {
    const eventName = event.constructor.name;
    return this.connection.getRepository(event.ctx, Webhook).find({
      where: { channelId: String(event.ctx.channelId), event: eventName },
    });
  }

  /**
   * Save set of webhooks for current channel.
   * Overrides any previously set hooks
   */
  async saveWebhooks(
    ctx: RequestContext,
    inputs: WebhookInput[]
  ): Promise<Webhook[]> {
    const repository = this.connection.getRepository(ctx, Webhook);
    // Delete all current hooks
    await repository.delete({ channelId: String(ctx.channelId) });
    // Recreate all hooks
    const webhooks: Partial<Webhook>[] = inputs.map((input) => ({
      channelId: String(ctx.channelId),
      url: input.url,
      event: input.event,
      transformerName: input.transformerName ?? undefined,
    }));
    await repository.save(webhooks);
    return this.getAllWebhooks(ctx);
  }

  /**
   * Push the webhooks for the given Event to the queue,
   * so they can be processed in batch
   */
  async addWebhookToQueue(event: EventWithContext): Promise<void> {
    const webhooks = await this.getWebhooksForEvent(event);
    webhooks.map((webhook) => {
      this.webhookQueue.set(webhook.id, webhook);
    });
    if (webhooks.length > 0) {
      Logger.info(
        `Added ${webhooks.length} webhooks to the webhook queue for ${event.constructor.name}`,
        loggerCtx
      );
    }
  }

  /**
   * Process all webhooks currently in the queue
   */
  async processQueue(event: EventWithContext): Promise<void> {
    // Check if queue already handled
    if (this.webhookQueue.size === 0) {
      return;
    }
    // Copy queue, and empty original
    const webhooks: Webhook[] = [];
    this.webhookQueue.forEach((webhook) => webhooks.push(webhook));
    this.webhookQueue.clear();
    // Start calling the webhooks
    await Promise.all(
      webhooks.map(async (webhook) => {
        try {
          await this.callWebhook(webhook, event);
        } catch (e) {
          Logger.error(
            `Failed to call webhook for event ${webhook.event} channel ${webhook.channelId}: ${e}`,
            loggerCtx
          );
        }
      })
    );
  }

  /**
   * Call the actual webhook with the configured Transformer for given Event
   */
  async callWebhook(webhook: Webhook, event: EventWithContext): Promise<void> {
    let headers: HeadersInit = {};

    // Add default authorization header if configured
    if (this.options.useAuthorizationHeader) {
      const token = await this.webhookToken.value();
      if (token) {
        headers['authorization'] = token;
      } else {
        Logger.error(
          `Could not get webhook token but 'useAuthorizationHeader' is enabled.`,
          loggerCtx
        );
      }
    }

    // Call the webhook without transformer
    if (!webhook.transformerName) {
      await fetch(webhook.url, { method: 'POST', headers: headers });
      Logger.info(
        `Successfully triggered webhook for event ${webhook.event} for channel ${webhook.channelId} without transformer`,
        loggerCtx
      );
      return;
    }

    // Find and apply the configured transformer
    const transformer = this.getAvailableTransformers().find(
      (transformer) => transformer.name === webhook.transformerName
    );

    if (!transformer) {
      throw Error(`Could not find transformer ${webhook.transformerName}`);
    }

    const request = await transformer.transform(
      event,
      new Injector(this.moduleRef),
      webhook
    );

    headers = {
      ...headers,
      ...request.headers,
    };

    // Call the webhook with the constructed request
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: headers,
        body: request.body,
      });
      Logger.info(
        `Successfully triggered webhook for event ${event.constructor.name} for channel ${webhook.channelId} with transformer "${webhook.transformerName}"`,
        loggerCtx
      );
    } catch (error) {
      Logger.error(
        `Failed to call webhook for event ${webhook.event} channel ${webhook.channelId}: ${error}`,
        loggerCtx
      );
    }
  }
}
