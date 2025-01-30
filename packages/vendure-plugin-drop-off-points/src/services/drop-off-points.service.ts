import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, RequestContext, UserInputError } from '@vendure/core';
import { DROP_OFF_POINTS_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions, SavedDropOffPoint } from '../types';
import {
  ParcelDropOffPoint,
  ParcelDropOffPointSearchInput,
} from '../types-generated-graphql';

@Injectable()
export class DropOffPointsService {
  private readonly injector: Injector;
  constructor(
    @Inject(DROP_OFF_POINTS_PLUGIN_OPTIONS) private options: PluginInitOptions,
    private moduleRef: ModuleRef
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
        id: point.dropOffPointId,
        name: point.name,
        houseNumber: point.houseNumber,
        houseNumberSuffix: point.houseNumberSuffix ?? undefined,
        streetLine1: point.streetLine1,
        streetLine2: point.streetLine2 ?? undefined,
        postalCode: point.postalCode,
        city: point.city,
        country: point.country,
      };
      // Encode each point with base64, so that we can unpack it when it is selected
      const token = Buffer.from(JSON.stringify(savedPoint)).toString('base64');
      return {
        ...point,
        token,
      };
    });
  }
}
