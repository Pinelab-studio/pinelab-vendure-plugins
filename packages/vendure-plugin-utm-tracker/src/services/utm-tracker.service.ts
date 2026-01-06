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
import { IsNull } from 'typeorm';

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

  async addMultipleUTMParametersToOrder(
    ctx: RequestContext,
    inputs: UTMParameterInput[]
  ): Promise<boolean> {
    const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
    if (!order) {
      throw new UserInputError('No active order found');
    }
    // Sort inputs by connectedAt date, descending
    inputs.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
    // Make sure we don't save more than the maximum number of parameters
    if (inputs.length > this.options.maxParametersPerOrder) {
      // Slice off the oldest parameters, so we only keep the most recent ones
      inputs = inputs.slice(0, this.options.maxParametersPerOrder);
    }
    for (const input of inputs) {
      await this.addUTMParameterToOrder(ctx, input, order).catch((e) => {
        Logger.error(
          `Error adding UTM parameter to order ${order.code}: ${e}`,
          loggerCtx,
          asError(e).stack
        );
      });
    }
    // Check if we have reached the maximum number of parameters
    const parameters = await this.getUTMParameters(ctx, order.id);
    if (parameters.length > this.options.maxParametersPerOrder) {
      // Remove oldest parameter
      const oldestParameters = parameters.slice(
        this.options.maxParametersPerOrder,
        parameters.length
      ); // slice of MAX to END of array
      const oldestParameterIds = oldestParameters.map((p) => p.id);
      await this.connection
        .getRepository(ctx, UtmOrderParameter)
        .delete(oldestParameterIds as string[]); // This assertion is safe: ID's are always all numbers or all strings
      Logger.info(
        `Removed oldest UTM parameters '${oldestParameters
          .map((p) => p.id)
          .join(', ')}' from order ${order.id} (${order.code})`,
        loggerCtx
      );
    }
    return true;
  }

  async addUTMParameterToOrder(
    ctx: RequestContext,
    input: UTMParameterInput,
    order: Order
  ): Promise<void> {
    input = this.sanitizeInput(input);
    if (
      !input.source &&
      !input.medium &&
      !input.campaign &&
      !input.term &&
      !input.content
    ) {
      throw new UserInputError('At least one UTM parameter is required');
    }
    let campaignDisplayName = input.campaign;
    if (this.options.getCampaignDisplayName) {
      campaignDisplayName = this.options.getCampaignDisplayName(ctx, input);
    }
    const utmRepo = this.connection.getRepository(ctx, UtmOrderParameter);
    // Check if the given params already exists
    const existingParameter = await utmRepo.findOne({
      where: {
        orderId: order.id,
        utmSource: input.source ?? IsNull(),
        utmMedium: input.medium ?? IsNull(),
        utmCampaign: input.campaign ?? IsNull(),
        utmTerm: input.term ?? IsNull(),
        utmContent: input.content ?? IsNull(),
      },
    });
    if (existingParameter) {
      await utmRepo.update(existingParameter.id, {
        connectedAt: input.connectedAt,
        campaignDisplayName,
      });
      Logger.info(
        `Updated existing UTM parameters '${existingParameter.id}' of order ${order.id} (${order.code})`,
        loggerCtx
      );
    } else {
      // Create new parameter
      await utmRepo.save({
        campaignDisplayName,
        orderId: order.id,
        utmSource: input.source,
        utmMedium: input.medium,
        utmCampaign: input.campaign,
        utmTerm: input.term,
        utmContent: input.content,
        connectedAt: input.connectedAt,
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
  }

  async getUTMParameters(
    ctx: RequestContext,
    orderId: ID
  ): Promise<UtmOrderParameter[]> {
    const utmRepo = this.connection.getRepository(ctx, UtmOrderParameter);
    return await utmRepo.find({
      where: { orderId: orderId },
      order: { connectedAt: 'DESC' },
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
        attributionModel: this.options.attributionModel.name,
      });
    }
    Logger.info(
      `Saved attribution percentages for order ${order.id} (${order.code}). Attribution model: ${this.options.attributionModel.name}`,
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
