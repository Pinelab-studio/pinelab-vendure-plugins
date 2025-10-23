import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  ActiveOrderService,
  EventBus,
  ID,
  Logger,
  Order,
  OrderPlacedEvent,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { loggerCtx, UTM_TRACKER_PLUGIN_OPTIONS } from '../constants';
import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { UTMParameterInput, UTMTrackerPluginInitOptions } from '../types';
import { asError } from 'catch-unknown';

@Injectable()
export class UTMTrackerService implements OnApplicationBootstrap {
  constructor(
    private readonly connection: TransactionalConnection,
    @Inject(UTM_TRACKER_PLUGIN_OPTIONS)
    private readonly options: UTMTrackerPluginInitOptions,
    private readonly activeOrderService: ActiveOrderService,
    private readonly eventBus: EventBus
  ) {}

  onApplicationBootstrap() {
    // Calculate attribution on order placed event
    this.eventBus.ofType(OrderPlacedEvent).subscribe((event) => {
      this.calculateAttribution(event.ctx, event.order).catch((e) => {
        Logger.error(
          `Error calculating attribution for order ${event.order.code}: ${e}`,
          loggerCtx,
          asError(e).stack
        );
      });
    });
  }

  async addUTMParametersToOrder(
    ctx: RequestContext,
    input: UTMParameterInput
  ): Promise<boolean> {
    const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
    if (!order) {
      throw new UserInputError('No active order found');
    }
    input = this.sanitizeInput(input);
    if (
      !input.source &&
      !input.medium &&
      !input.campaign &&
      !input.term &&
      !input.content
    ) {
      throw new UserInputError('At least one UTM parameters is required');
    }
    const utmRepo = this.connection.getRepository(ctx, UtmOrderParameter);
    // Check if the given params already exists
    const existingParameter = await utmRepo.findOne({
      where: {
        orderId: order.id,
        utmSource: input.source,
        utmMedium: input.medium,
        utmCampaign: input.campaign,
        utmTerm: input.term,
        utmContent: input.content,
      },
    });
    if (existingParameter) {
      await utmRepo.update(existingParameter.id, {
        connectedAt: new Date(),
      });
      Logger.info(
        `Updated existing UTM parameters '${existingParameter.id}' of order ${order.id} (${order.code})`,
        loggerCtx
      );
    } else {
      // Create new parameter
      await utmRepo.save({
        orderId: order.id,
        utmSource: input.source,
        utmMedium: input.medium,
        utmCampaign: input.campaign,
        utmTerm: input.term,
        utmContent: input.content,
        connectedAt: new Date(),
      });
      Logger.info(
        `Added UTM parameters to order ${order.id} (${order.code}): source=${
          input.source ?? ''
        } medium=${input.medium ?? ''} campaign=${input.campaign ?? ''} term=${
          input.term ?? ''
        } content=${input.content ?? ''}`,
        loggerCtx
      );
    }
    // Check if we have reached the maximum number of parameters
    const parameters = await this.getUTMParameters(ctx, order.id);
    if (parameters.length > this.options.maxParametersPerOrder) {
      // Remove oldest parameter
      const oldestParameter = parameters[0];
      await utmRepo.delete(oldestParameter.id);
      Logger.info(
        `Removed oldest UTM parameter '${oldestParameter.id}' from order ${order.id} (${order.code})`,
        loggerCtx
      );
    }
    return true;
  }

  async getUTMParameters(
    ctx: RequestContext,
    orderId: ID
  ): Promise<UtmOrderParameter[]> {
    const utmRepo = this.connection.getRepository(ctx, UtmOrderParameter);
    return await utmRepo.find({
      where: { orderId: orderId },
      order: { connectedAt: 'ASC' },
    });
  }

  /**
   * Calculate the attribution for each UTM parameter of the given order, and save it in the database.
   * This uses the configured attribution model to calculate the attribution.
   */
  async calculateAttribution(
    ctx: RequestContext,
    order: Order
  ): Promise<UtmOrderParameter[]> {
    let utmParameters = await this.getUTMParameters(ctx, order.id);
    // filter out old parameters
    const maxAttributionAge = new Date(
      Date.now() - this.options.maxAttributionAgeInDays * 24 * 60 * 60 * 1000
    );
    utmParameters = utmParameters.filter(
      (param) => param.connectedAt > maxAttributionAge
    );
    const results = this.options.attributionModel.calculateAttribution(
      utmParameters,
      order
    );
    const totalAttribution = results.reduce(
      (acc, result) => acc + result.attributionPercentage,
      0
    );
    if (totalAttribution > 1) {
      Logger.error(
        `Total attribution must be between 0 and 1. Total attribution for order ${order.id} (${order.code}): ${totalAttribution}. Not saving attribution.`,
        loggerCtx
      );
      return [];
    }
    const utmRepo = this.connection.getRepository(ctx, UtmOrderParameter);
    for (const param of utmParameters) {
      const result = results.find((r) => r.utmParameterId === param.id);
      await utmRepo.update(param.id, {
        attributedPercentage: result?.attributionPercentage || 0,
      });
    }
    Logger.info(
      `Saved attribution percentages for order ${order.id} (${order.code})`,
      loggerCtx
    );
    return await this.getUTMParameters(ctx, order.id);
  }

  /**
   * Remove starting and trailing spaces for each key
   */
  sanitizeInput(input: UTMParameterInput): UTMParameterInput {
    return {
      ...input,
      source: input.source?.trim(),
      medium: input.medium?.trim(),
      campaign: input.campaign?.trim(),
      term: input.term?.trim(),
      content: input.content?.trim(),
    };
  }
}
