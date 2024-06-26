import { Inject, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';
import { ApiKeySession, EventCreateQueryV2, EventsApi } from 'klaviyo-api';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from './constants';
import {
  EventWithContext,
  KlaviyoEventHandler,
  KlaviyoGenericEvent,
  KlaviyoOrderPlacedEvent,
  KlaviyoOrderPlacedEventHandler,
} from './event-handler/klaviyo-event-handler';
import { KlaviyoPluginOptions } from './klaviyo.plugin';
import {
  mapToKlaviyoEventInput,
  mapToKlaviyoOrderPlacedInput,
  mapToOrderedProductEvent,
} from './util/map-to-klaviyo-input';
import { isAxiosError } from 'axios';

interface GenericEventJobData {
  action: 'handle-event';
  ctx: SerializedRequestContext;
  event: KlaviyoGenericEvent;
}

interface OrderEventJobData {
  action: 'handle-order-event';
  ctx: SerializedRequestContext;
  event: KlaviyoOrderPlacedEvent;
}

type JobData = GenericEventJobData | OrderEventJobData;

export class KlaviyoService implements OnApplicationBootstrap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Weird TS error, but our JobData is JSON compatible
  private jobQueue!: JobQueue<any>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: KlaviyoPluginOptions,
    private readonly eventBus: EventBus
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Create JobQueue and handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'klaviyo',
      process: async ({ data: _data }) => {
        const data = _data as JobData;
        const ctx = RequestContext.deserialize(data.ctx);
        try {
          if (data.action === 'handle-event') {
            await this.handleGenericEvent(ctx, data.event);
          } else if (data.action === 'handle-order-event') {
            await this.handleOrderEvent(ctx, data.event);
          }
          Logger.info(`Successfully handled job '${data.action}'`, loggerCtx);
        } catch (e) {
          Logger.warn(
            `Failed to handle job '${data.action}': ${
              (e as Error).message
            }. Job data: ${JSON.stringify(data.event)}`,
            loggerCtx
          );
          throw e;
        }
      },
    });
    if (this.options.eventHandlers.length === 0) {
      Logger.error(
        `No event handlers configured for Klaviyo. No events will be sent to Klaviyo. This means the plugin isn't doing anything.`,
        loggerCtx
      );
      return;
    }
    // Listen for OrderPlacedEvent
    this.eventBus.ofType(OrderPlacedEvent).subscribe((event) => {
      Logger.info(`Creating job for '${event.constructor.name}'`, loggerCtx);
      this.createOrderEventJob(event).catch((err) => {
        Logger.error(
          `Error creating order event job: ${err}`,
          loggerCtx,
          (err as Error)?.stack
        );
      });
    });
    // Listen for configured event handlers
    this.options.eventHandlers.forEach((handler) => {
      if (handler.vendureEvent === OrderPlacedEvent) {
        // OrderPlacedEvent is handled separately below
        return;
      }
      this.eventBus.ofType(handler.vendureEvent).subscribe((event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Logger.info(`Creating job for '${event?.constructor.name}'`, loggerCtx);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.createEventJob(event, handler).catch((err) => {
          Logger.error(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error creating event job for '${event?.constructor.name}': ${err}`,
            loggerCtx,
            (err as Error)?.stack
          );
        });
      });
    });
    Logger.info(
      `Listening for events: ${this.options.eventHandlers
        .map((e) => e.vendureEvent.name)
        .join(', ')}`,
      loggerCtx
    );
  }

  /**
   * Create Jobs to sent Placed Order Events to Klaviyo.
   * This calls the configured event handler and sends the result to the job queue
   */
  async createOrderEventJob(
    orderPlacedEvent: OrderPlacedEvent,
    retries = 10
  ): Promise<void> {
    const orderPlacedHandlers = this.options.eventHandlers.filter(
      (handler) => handler.vendureEvent === OrderPlacedEvent
    );
    if (!orderPlacedHandlers.length) {
      Logger.warn(
        `No order placed event mapper configured for Klaviyo, not sending Placed Order and Ordered Product events`,
        loggerCtx
      );
      return;
    }
    for (const handler of orderPlacedHandlers) {
      const event = await (
        handler as KlaviyoOrderPlacedEventHandler
      ).mapToKlaviyoEvent(orderPlacedEvent, new Injector(this.moduleRef));
      if (event) {
        const jobData: OrderEventJobData = {
          action: 'handle-order-event',
          ctx: orderPlacedEvent.ctx.serialize(),
          event,
        };
        await this.jobQueue.add(jobData, { retries });
      }
    }
  }

  /**
   * Create Jobs to sent events to Klaviyo based on the given Vendure event.
   * This calls the configured event handler for the event and sends the result to the job queue
   */
  async createEventJob<T extends EventWithContext>(
    vendureEvent: T,
    eventHandler: KlaviyoEventHandler<T>,
    retries = 10
  ): Promise<void> {
    const event = await eventHandler.mapToKlaviyoEvent(
      vendureEvent,
      new Injector(this.moduleRef)
    );
    if (event) {
      const jobData: GenericEventJobData = {
        action: 'handle-event',
        ctx: vendureEvent.ctx.serialize(),
        event,
      };
      await this.jobQueue.add(jobData, { retries });
    }
  }

  /**
   * Push an order to Klaviyo as 'Placed Order Event' and create 'Ordered Product Events for each order line
   * https://developers.klaviyo.com/en/docs/guide_to_integrating_a_platform_without_a_pre_built_klaviyo_integration#ordered-product
   */
  async handleOrderEvent(
    ctx: RequestContext,
    event: KlaviyoOrderPlacedEvent
  ): Promise<void> {
    const klaviyoApi = await this.getKlaviyoApi(ctx);
    await this.createEvent(klaviyoApi, mapToKlaviyoOrderPlacedInput(event));
    Logger.info(
      `Sent' Placed Order' event to Klaviyo for order ${event.orderId}`,
      loggerCtx
    );
    for (const [index, orderItem] of event.orderItems.entries()) {
      const orderedProductEvent = mapToOrderedProductEvent(
        orderItem,
        index,
        event
      );
      await this.createEvent(klaviyoApi, orderedProductEvent);
    }
    Logger.info(
      `Sent 'Ordered Product' event to Klaviyo for order ${event.orderId} for ${event.orderItems.length} order lines`,
      loggerCtx
    );
  }

  /**
   * Push an order to Klaviyo as 'Placed Order Event' and create 'Ordered Product Events for each order line
   */
  async handleGenericEvent(
    ctx: RequestContext,
    event: KlaviyoGenericEvent
  ): Promise<void> {
    const klaviyoApi = await this.getKlaviyoApi(ctx);
    await this.createEvent(klaviyoApi, mapToKlaviyoEventInput(event));
    Logger.info(
      `Sent '${event.eventName}' event with event ID '${event.uniqueId}' to Klaviyo.`,
      loggerCtx
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- In future implementation we can make this channel aware, where the API key is stored in the DB per channel
  async getKlaviyoApi(ctx: RequestContext): Promise<EventsApi> {
    const session = new ApiKeySession(this.options.apiKey);
    return new EventsApi(session);
  }

  /**
   * Creates an event in Klaviyo, but checks the response status code and throws an error if it's not 2xx
   */
  async createEvent(
    klaviyoApi: EventsApi,
    event: EventCreateQueryV2
  ): Promise<void> {
    try {
      const {
        response: { status, statusText },
      } = await klaviyoApi.createEvent(event);
      if (status < 200 || status > 299) {
        throw new Error(
          `[${loggerCtx}]: Failed to create event '${event.data.attributes.metric.data.attributes.name}': ${statusText} (${status})`
        );
      }
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (isAxiosError(e) && e.response?.data?.errors[0]?.detail) {
        // Throw more specific Klaviyo error if available

        throw Error(
          // eslint-disable-next-line
          e.response?.data.errors.map((error: any) => error?.detail)?.join(', ')
        );
      } else {
        throw e;
      }
    }
  }
}
