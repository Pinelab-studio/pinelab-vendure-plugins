import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { FulfillOrderInput } from '@vendure/common/lib/generated-types';
import {
  Channel,
  EntityHydrator,
  EventBus,
  FulfillmentState,
  isGraphQlErrorResult,
  JobQueue,
  JobQueueService,
  Logger,
  manualFulfillmentHandler,
  Order,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionEvent,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { ShipmatePluginConfig } from '../shipmate.plugin';
import { EventPayload, TrackingEventPayload } from '../types';
import { ShipmateClient } from './shipmate-client';
import { ShipmateConfigService } from './shipmate-config.service';
import { parseOrder } from './util';

interface JobData {
  ctx: SerializedRequestContext;
  orderCode: string;
  cancelExistingFirst: boolean;
}

@Injectable()
export class ShipmateService implements OnApplicationBootstrap {
  jobQueue!: JobQueue<JobData>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private config: ShipmatePluginConfig,
    private shipmateConfigService: ShipmateConfigService,
    private orderService: OrderService,
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private entityHydrator: EntityHydrator,
    private jobQueueService: JobQueueService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'shipmate',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        await this.upsertShipment(
          ctx,
          job.data.orderCode,
          job.data.cancelExistingFirst
        );
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    void this.eventBus
      .ofType(OrderPlacedEvent)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      .subscribe(async ({ ctx, order }) => {
        await this.jobQueue
          .add(
            {
              ctx: ctx.serialize(),
              orderCode: order.code,
              //prior to the Order being placed, there won't be any Shipments associated with it in Shipmate
              cancelExistingFirst: false,
            },
            { retries: 2 }
          )
          .catch((err) => {
            Logger.error(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Error adding OrderPlacedEvent job to queue: ${err?.message}`,
              loggerCtx,
              util.inspect(err)
            );
          });
      });
    this.eventBus
      .ofType(OrderStateTransitionEvent)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      .subscribe(async ({ ctx, order, fromState }) => {
        await this.entityHydrator.hydrate(ctx, order, {
          relations: ['fulfillments'],
        });
        if (
          fromState === 'Modifying' &&
          order.orderPlacedAt &&
          !order.fulfillments?.length
        ) {
          await this.jobQueue
            .add(
              {
                ctx: ctx.serialize(),
                orderCode: order.code,
                cancelExistingFirst: true,
              },
              { retries: 2 }
            )
            .catch((err) => {
              Logger.error(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                `Error adding OrderStateTransitionEvent job to queue: ${err?.message}`,
                loggerCtx,
                util.inspect(err)
              );
            });
        }
      });
  }

  async upsertShipment(
    ctx: RequestContext,
    orderCode: string,
    cancelExistingFirst: boolean
  ): Promise<void> {
    const client = await this.getClient(ctx);
    if (!client) {
      Logger.info(
        `Can not create shipment for '${ctx.channel.code}'. Shipmate is not enabled`,
        loggerCtx
      );
      return;
    }
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`[${loggerCtx}] Order with code ${orderCode} not found`);
    }
    if (cancelExistingFirst) {
      try {
        //the following line assumes that an Order code will be used as the shipment_refrence
        //but this won't be true once we start implementing many Shipments per Order
        await client.cancelShipment(order.code);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // Log error as history entry for admins
        await this.orderService
          .addNoteToOrder(ctx, {
            id: order.id,
            isPublic: false,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            note: `Failed to cancel Shipment on Shipmate: ${err?.message}`,
          })
          .catch((err) =>
            Logger.error(
              // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access
              `Error creating history entryfor ${order.code}: ${err.message}`,
              loggerCtx
            )
          );
        throw err;
      }
    }
    try {
      await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] });
      for (const line of order.lines) {
        await this.entityHydrator.hydrate(ctx, line, {
          relations: ['productVariant.product'],
        });
      }
      const payload = parseOrder(order, order.code);
      await client.createShipment(payload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Log error as history entry for admins
      await this.orderService
        .addNoteToOrder(ctx, {
          id: order.id,
          isPublic: false,
          // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access
          note: `Failed to send to Shipmate: ${err?.message}`,
        })
        .catch((err) =>
          Logger.error(
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access
            `Error creating history entryfor ${order.code}: ${err.message}`,
            loggerCtx
          )
        );
      throw err;
    }
  }

  /**
   * Update Vendure order state by incoming Shipment event
   */
  async updateOrderState(payload: EventPayload): Promise<void> {
    const ctx = await this.createCtxForWebhookToken(payload.auth_token);
    if (!ctx) {
      Logger.warn(
        `No Shipmate config found with webhook auth token '${payload.auth_token}'`,
        loggerCtx
      );
      return;
    }
    const order = await this.orderService.findOneByCode(
      ctx,
      payload.order_reference
    );
    if (!order) {
      Logger.warn(
        `No Order with code ${payload.order_reference} in channel ${ctx.channel.code}`,
        loggerCtx
      );
      return;
    }
    Logger.info(
      `${payload.event} event received for Order with code ${payload.order_reference} in channel ${ctx.channel.code}`,
      loggerCtx
    );
    if (payload.event === 'TRACKING_COLLECTED') {
      await this.updateFulFillment(ctx, order, payload, 'Shipped');
      Logger.info(`Order successfully marked as  Shipped`, loggerCtx);
      return;
    } else if (payload.event === 'TRACKING_DELIVERED') {
      await this.updateFulFillment(ctx, order, payload, 'Delivered');
      Logger.info(`Order successfully marked as Delivered`, loggerCtx);
      return;
    }
    Logger.info(
      `No configured handler for event "${payload.event}"`,
      loggerCtx
    );
  }

  /**
   * Update Vendure Fulfillments. Creates fulfilments if none exist yet
   */
  async updateFulFillment(
    ctx: RequestContext,
    order: Order,
    payload: EventPayload,
    state: FulfillmentState
  ) {
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['fulfillments'],
    });
    if (!order.fulfillments?.length) {
      // Create fulfillments first if none exist
      const fulfillmentInputs = this.createFulfillOrderInput(order, payload);
      const createdFulfillmentResult =
        await this.orderService.createFulfillment(ctx, fulfillmentInputs);
      if (isGraphQlErrorResult(createdFulfillmentResult)) {
        Logger.info(
          `Unable to create Fulfillment for order ${order.code}: ${createdFulfillmentResult.message}`,
          loggerCtx
        );
        await this.orderService.addNoteToOrder(ctx, {
          id: order.id,
          isPublic: false,
          note: `Failed to create Fullfillment: ${createdFulfillmentResult.message}`,
        });
        throw createdFulfillmentResult.message;
      }
      if (createdFulfillmentResult.state !== state) {
        const transitionResult =
          await this.orderService.transitionFulfillmentToState(
            ctx,
            createdFulfillmentResult.id,
            state
          );
        if (isGraphQlErrorResult(transitionResult)) {
          Logger.error(
            `Unable to transition Fulfillment ${createdFulfillmentResult.id} of order ${order.code} to ${state}: ${transitionResult.transitionError}`,
            loggerCtx
          );
          await this.orderService.addNoteToOrder(ctx, {
            id: order.id,
            isPublic: false,
            note: `Failed to transition Fullfillment ${createdFulfillmentResult.id} from ${transitionResult.fromState} to ${transitionResult.toState}`,
          });
          throw transitionResult.transitionError;
        }
      }
    }
    for (const fulfillment of order.fulfillments) {
      if (fulfillment.state !== state) {
        const transitionResult =
          await this.orderService.transitionFulfillmentToState(
            ctx,
            fulfillment.id,
            state
          );
        if (isGraphQlErrorResult(transitionResult)) {
          Logger.error(
            `Unable to transition Fulfillment ${fulfillment.id} of order ${order.code} to ${state}: ${transitionResult.transitionError}`,
            loggerCtx
          );
          await this.orderService.addNoteToOrder(ctx, {
            id: order.id,
            isPublic: false,
            note: `Failed to transition Fullfillment(${fulfillment.id}) from ${transitionResult.fromState} to ${transitionResult.toState}`,
          });
          throw transitionResult.transitionError;
        }
      }
    }
  }

  /**
   * Create Vedure Fulfillments
   */
  createFulfillOrderInput(
    order: Order,
    payload: EventPayload
  ): FulfillOrderInput {
    return {
      handler: {
        arguments: [
          { name: 'method', value: manualFulfillmentHandler.code },
          {
            name: 'trackingCode',
            value: (payload as TrackingEventPayload).tracking_number,
          },
        ],
        code: manualFulfillmentHandler.code,
      },
      lines: order.lines.map((line) => {
        return {
          orderLineId: line.id,
          quantity: line.quantity,
        };
      }),
    };
  }

  /**
   * If no client is returned, Shipmate is not configured for the channel
   */
  async getClient(ctx: RequestContext): Promise<ShipmateClient | undefined> {
    const shipmateConfig = await this.shipmateConfigService.getConfig(ctx);
    if (!shipmateConfig) {
      Logger.info(
        `Shipmate credentials not configured for channel ${ctx.channel.code}`,
        loggerCtx
      );
      return;
    }
    return new ShipmateClient({
      apiKey: shipmateConfig.apiKey,
      username: shipmateConfig.username,
      password: shipmateConfig.password,
      apiUrl: this.config.apiUrl,
    });
  }

  /**
   * Create RequestContext or the given Shipmate auth token
   */
  private async createCtxForWebhookToken(
    webhookAuthToken: string
  ): Promise<RequestContext | undefined> {
    const config =
      await this.shipmateConfigService.getConfigWithWebhookAuthToken(
        webhookAuthToken
      );
    if (!config) {
      Logger.error(`No channel with this webhooks auth token`, loggerCtx);
      return;
    }
    const channel = (await this.connection.getRepository(Channel).findOne({
      where: { id: config.channelId },
      relations: ['defaultTaxZone', 'defaultShippingZone'],
    })) as Channel;
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
}
