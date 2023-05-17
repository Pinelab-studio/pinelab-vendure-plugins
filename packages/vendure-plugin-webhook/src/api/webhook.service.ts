import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  ID,
  Injector,
  Logger,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Webhook } from './webhook.entity';
import fetch from 'node-fetch';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { EventWithContext } from './request-transformer';
import { WebhookPluginOptions } from '../webhook.plugin';

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

  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private moduleRef: ModuleRef,
    @Injectable(PLUGIN_INIT_OPTIONS) private options: WebhookPluginOptions
  ) { }


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
      Logger.info(`Webhook plugin disabled,not listening for events`, loggerCtx);
      return;
    }
    // Subscribe to all configured events
    this.options.events.forEach((configuredEvent) => {
      this.eventBus.ofType(configuredEvent).subscribe(async (event) => {
        try {
          await this.addWebhookToQueue(event);
          // Start processing after the given delay, because 
          // we might get multiple of the same events within the specified delay
          await new Promise((resolve) => setTimeout(resolve, this.options.delay));
          await this.processQueue();
        } catch (e: unknown) {
          Logger.error(
            `Failed to call webhook for event ${event.constructor.name} for channel ${event.ctx.channelId}: ${e}`,
            loggerCtx,
          )
        }
      });
    });
  }

  /**
   * Get the plugins configured events. 
   * This is needed to display the selectable events in the admin ui
   */
  async getAvailableEvents(): Promise<string[]> {
    return this.options.events.map((event) => event.constructor.name);
  }

  /**
   * Get the plugins configured events. 
   * This is needed to display the selectable events in the admin ui
   */
  async getAvailableTransformers(): Promise<string[]> {
    return (this.options.requestTransformers || []).map((transformer) => transformer.name);
  }

  /**
   * Get all configured webhooks for current channel
   */
  async getAllWebhooks(
    ctx: RequestContext
  ): Promise<Webhook[]> {
    return this.connection
      .getRepository(ctx, Webhook)
      .find({ channelId: String(ctx.channelId) });
  }

  /**
   * Get configured webhooks for given Event
   */
  async getWebhooksForEvent<T extends EventWithContext>(
    event: T
  ): Promise<Webhook[]> {
    const eventName = event.constructor.name;
    return this.connection
      .getRepository(event.ctx, Webhook)
      .find({ channelId: String(event.ctx.channelId), event: eventName });
  }

  /**
   * Create or update a webhook configuration
   */
  async saveWebhook(
    ctx: RequestContext,
    webhookUrl: string,
    event: string,
    transformerName?: string
  ): Promise<Webhook[]> {
    // Check if any configs already exist based on channel, event and transformer
    const existingConfiguration = await this.connection
      .getRepository(ctx, Webhook)
      .findOne({
        channelId: String(ctx.channelId),
        event,
        transformerName
      });
    const newConfiguration: Partial<Webhook> = {
      channelId: String(ctx.channelId),
      url: webhookUrl,
      event,
      transformerName
    }
    if (existingConfiguration) {
      await this.connection.getRepository(ctx, Webhook).update({ id: existingConfiguration.id }, newConfiguration);

    } else {
      await this.connection.getRepository(ctx, Webhook).save(newConfiguration);
    }
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
    Logger.info(`Added ${webhooks.length} to the webhook queue for event ${event.constructor.name}`, loggerCtx);
  }

  /**
   * Handle all webhooks currently in the queue
   */
  async processQueue(): Promise<void> {
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
          if (!webhook.transformerName) {
            // No transformer, just call webhook
            await fetch(webhook.url, { method: 'POST' });
          } else {
            // Have the configured transformer construct the request
            const transformer = this.options.requestTransformers?.find((transformer) => transformer.constructor.name === webhook.transformerName);
            if (!transformer) {
              throw Error(`Could not find transformer ${webhook.transformerName}`);
            }
            const request = transformer.
            // Call the webhook with the constructed request
          }
            const transformer = this.options.requestTransformers?.find((transformer) => transformer.constructor.name === webhook.transformerName);
            const request = await this.options.requestTransformers?.(
              event,
              new Injector(this.moduleRef)
            );
            await fetch(url, {
              method: 'POST',
              headers: request?.headers,
              body: request?.body,
            });
            Logger.info(
              `Successfully triggered webhook for channel ${channel}`,
              loggerCtx
            );
          } catch (e) {
            Logger.error(
              `Failed to call webhook for event ${webhook.event} channel ${webhook.channelId}: ${e}`,
              loggerCtx,
            );
          }
        })
    );
  }

}
