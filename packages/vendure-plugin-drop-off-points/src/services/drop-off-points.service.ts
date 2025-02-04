import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ActiveOrderService,
  assertFound,
  Injector,
  Order,
  OrderService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { DROP_OFF_POINTS_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions, SavedDropOffPoint } from '../types';
import { asError } from 'catch-unknown';
import {
  ParcelDropOffPoint,
  ParcelDropOffPointSearchInput,
} from '../types-generated-graphql';

@Injectable()
export class DropOffPointsService {
  private readonly injector: Injector;
  constructor(
    @Inject(DROP_OFF_POINTS_PLUGIN_OPTIONS)
    private readonly options: PluginInitOptions,
    private readonly moduleRef: ModuleRef,
    private readonly activeOrderService: ActiveOrderService,
    private readonly orderService: OrderService
  ) {
    this.injector = new Injector(this.moduleRef);
  }

  async getDropOffPoints(
    ctx: RequestContext,
    input: ParcelDropOffPointSearchInput
  ): Promise<ParcelDropOffPoint[]> {
    const carrier = this.options.carriers.find((c) => c.name === input.carrier);
    if (!carrier) {
      throw new UserInputError(`Carrier '${input.carrier}' not found`);
    }
    const dropOffPoints = await carrier.getDropOffPoints(ctx, input);
    return dropOffPoints.map((point) => {
      const savedPoint: SavedDropOffPoint = {
        carrier: input.carrier,
        id: point.dropOffPointId,
        name: point.name,
        houseNumber: point.houseNumber,
        houseNumberSuffix: point.houseNumberSuffix ?? undefined,
        streetLine1: point.streetLine1,
        streetLine2: point.streetLine2 ?? undefined,
        postalCode: point.postalCode,
        city: point.city,
        country: point.country,
        additionalData: point.additionalData,
      };
      // Encode each point data, so that we can unpack it when it is selected
      const token = Buffer.from(JSON.stringify(savedPoint)).toString('base64');
      return {
        ...point,
        token,
      };
    });
  }

  async setDropOffPointOnOrder(
    ctx: RequestContext,
    token: string
  ): Promise<Order> {
    const point = this.getSavedPointFromToken(token);
    const activeOrder = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined,
      true
    );
    if (this.options.customMutations?.setDropOffPointOnOrder) {
      // Save using custom mutations
      const updatedOrder =
        await this.options.customMutations.setDropOffPointOnOrder(
          ctx,
          activeOrder,
          point
        );
      await this.orderService.updateCustomFields(ctx, activeOrder.id, {
        ...updatedOrder.customFields,
      });
    } else {
      await this.orderService.updateCustomFields(ctx, activeOrder.id, {
        dropOffPointCarrier: point.carrier,
        dropOffPointId: point.id,
        dropOffPointName: point.name,
        dropOffPointStreetLine1: point.streetLine1,
        dropOffPointStreetLine2: point.streetLine2,
        dropOffPointHouseNumber: point.houseNumber,
        dropOffPointHouseNumberSuffix: point.houseNumberSuffix,
        dropOffPointPostalCode: point.postalCode,
        dropOffPointCity: point.city,
        dropOffPointCountry: point.country,
      });
    }
    return await assertFound(this.orderService.findOne(ctx, activeOrder.id));
  }

  async unsetDropOffPoint(ctx: RequestContext): Promise<Order> {
    const activeOrder = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined,
      true
    );
    if (this.options.customMutations?.unsetDropOffPointOnOrder) {
      // Save using custom mutations
      const updatedOrder =
        await this.options.customMutations.unsetDropOffPointOnOrder(
          ctx,
          activeOrder
        );
      await this.orderService.updateCustomFields(ctx, activeOrder.id, {
        ...updatedOrder.customFields,
      });
    } else {
      await this.orderService.updateCustomFields(ctx, activeOrder.id, {
        dropOffPointCarrier: null,
        dropOffPointId: null,
        dropOffPointName: null,
        dropOffPointStreetLine1: null,
        dropOffPointStreetLine2: null,
        dropOffPointHouseNumber: null,
        dropOffPointHouseNumberSuffix: null,
        dropOffPointPostalCode: null,
        dropOffPointCity: null,
        dropOffPointCountry: null,
      });
    }
    return await assertFound(this.orderService.findOne(ctx, activeOrder.id));
  }

  /**
   * Decode the given based64 token, which holds the point data
   * and return the saved drop off point
   */
  private getSavedPointFromToken(token: string): SavedDropOffPoint {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const point: SavedDropOffPoint = JSON.parse(
        Buffer.from(token, 'base64').toString()
      );
      if (
        !point.id ||
        !point.name ||
        !point.postalCode ||
        !point.city ||
        !point.country
      ) {
        // Basic validation failed
        throw new Error('Invalid drop off point data in encoded token');
      }
      return point;
    } catch (e) {
      throw new UserInputError(
        `Invalid drop off point token: ${asError(e).message}`
      );
    }
  }
}
