import { Order, RequestContext } from '@vendure/core';
import {
  ParcelDropOffPoint,
  ParcelDropOffPointSearchInput,
} from './types-generated-graphql';
export interface PluginInitOptions {
  /**
   * The providers which will be used to fetch drop-off points.
   */
  carriers: DropOffPointCarrier[];
  /**
   * By default this plugin creates custom fields on an order for drop off points.
   * If you already have custom fields, you can implement `customMutations`
   * to set and unset drop off points on your order.
   */
  customMutations?: {
    setDropOffPointOnOrder?: (
      ctx: RequestContext,
      activeOrder: Order,
      dropOffPoint: SavedDropOffPoint
    ) => Promise<void>;
    unsetDropOffPointOnOrder?: (
      ctx: RequestContext,
      activeOrder: Order
    ) => Promise<void>;
  };
}

/**
 * The DropOff point that should be returned by a provider
 */
export type DropOffPoint = Omit<ParcelDropOffPoint, 'token'>;

export interface DropOffPointCarrier {
  name: string;
  getDropOffPoints: (
    ctx: RequestContext,
    input: ParcelDropOffPointSearchInput
  ) => Promise<DropOffPoint[]>;
}

/**
 * Representation of a drop off point when it's saved to an order.
 * This omits certain details like distance and geolocation,
 * because they don't matter anymore after selection
 */
export interface SavedDropOffPoint {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2?: string;
  houseNumber: string;
  houseNumberSuffix?: string;
  postalCode: string;
  city: string;
  country: string;
}
