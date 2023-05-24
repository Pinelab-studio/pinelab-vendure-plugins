import { Injectable, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  Injector,
  Logger,
  TransactionalConnection,
  VendureEvent,
} from '@vendure/core';
import { WebhookPerChannelEntity } from './webhook-per-channel.entity';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { WebhookPluginOptions } from './webhook-plugin-options';
import fetch from 'node-fetch';
import { loggerCtx } from '../constants';

/**
 * Service for updating and retrieving webhooks from db
 */
@Injectable()
export class WebhookService implements OnApplicationBootstrap {
  static queue = new Set<string>();

  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS) private options: WebhookPluginOptions<any>,
  ) {}

  async getWebhook(
    channelId: string
  ): Promise<WebhookPerChannelEntity | undefined> {
    return this.connection
      .getRepository(WebhookPerChannelEntity)
      .findOne({ channelId });
  }

  async saveWebhook(
    webhookUrl: string,
    channelId: string
  ): Promise<WebhookPerChannelEntity | undefined> {
    const existing = await this.connection
      .getRepository(WebhookPerChannelEntity)
      .findOne({ channelId });
    if (existing) {
      await this.connection.getRepository(WebhookPerChannelEntity).update(
        { id: existing.id },
        {
          channelId,
          url: webhookUrl,
        }
      );
    } else {
      await this.connection
        .getRepository(WebhookPerChannelEntity)
        .save({ channelId, url: webhookUrl });
    }
    return this.getWebhook(channelId);
  }

  /**
   * Subscribe to events specified in config
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.options || !this.options.events) {
      throw Error(
        `Please specify VendureEvents with Webhook.init() in your Vendure config.`
      );
    }
    if (this.options.disabled) {
      Logger.info(`Webhook plugin disabled`, loggerCtx);
      return;
    }
    this.options.events!.forEach((configuredEvent) => {
      this.eventBus.ofType(configuredEvent).subscribe((event) => {
        const channelId = (event as any)?.ctx?.channelId;
        if (!channelId) {
          Logger.error(
            `Cannot trigger webhook for event ${event.constructor.name}, because there is no channelId in event.ctx`,
            loggerCtx
          );
          return;
        }
        this.addToQueue(channelId as string, event) // Async, because we dont want failures in Vendure if a webhook fails
          .catch((e) =>
            Logger.error(
              `Failed to call webhook for event ${event.constructor.name} for channel ${channelId}`,
              loggerCtx,
              e
            )
          );
      });
    });
  }

  /**
   * Call webhook for channel. Saves up events in batches if a delay is defined
   * If multiple events arise within 1s, the webhook will only be called once
   */
  async addToQueue(channelId: string, event: VendureEvent): Promise<void> {
    const webhookPerChannel = await this.getWebhook(channelId);
    if (!webhookPerChannel || !webhookPerChannel.url) {
      Logger.info(`No webhook defined for channel ${channelId}`, loggerCtx);
      return;
    }
    WebhookService.queue.add(webhookPerChannel.url);
    if (this.options.delay) {
      setTimeout(() => this.doWebhook(event), this.options.delay);
    } else {
      await this.doWebhook(event);
    }
  }

  async doWebhook(event: VendureEvent): Promise<void> {
    // Check if queue already handled
    if (WebhookService.queue.size === 0) {
      return;
    }
    // Copy queue, and empty original
    const channels = Array.from(WebhookService.queue);
    WebhookService.queue.clear();
    await Promise.all(
      channels.map(async (channel) => {
        try {
          const request = await this.options.requestFn?.(
            event,
            new Injector(this.moduleRef)
          );
          await fetch(channel!, {
            method: this.options.httpMethod,
            headers: request?.headers,
            body: request?.body,
          });
          Logger.info(
            `Successfully triggered webhook for channel ${channel}`,
            loggerCtx
          );
        } catch (e) {
          Logger.error(
            `Failed to call webhook for channel ${channel}`,
            loggerCtx,
            e
          );
        }
      })
    );
  }
}
