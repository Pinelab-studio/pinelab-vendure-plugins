import { Order, RequestContext } from '@vendure/core';
import {
  ParcelDropOffPoint,
  ParcelDropOffPointSearchInput,
} from './types-generated-graphql';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- required for correct type resolution
import { CustomOrderFields } from '@vendure/core/dist/entity/custom-entity-fields';

export interface PluginInitOptions {
  /**
   * The providers which will be used to fetch drop-off points.
   */
  carriers: DropOffPointCarrier[];
  /**
   * By default this plugin creates custom fields on an order for drop off points.
   * If you already have custom fields, you can implement `customMutations`
   * to set and unset drop off points on your order.
   *
   * Both functions should set the custom fields on the order object.
   * Persistence is done by the plugin.
   */
  customMutations?: {
    setDropOffPointOnOrder?: (
      ctx: RequestContext,
      activeOrder: Order,
      dropOffPoint: SavedDropOffPoint
    ) => Promise<Order> | Order;
    unsetDropOffPoint?: (
      ctx: RequestContext,
      activeOrder: Order
    ) => Promise<Order> | Order;
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
  carrier: string;
  id: string;
  name: string;
  streetLine1: string;
  streetLine2?: string;
  houseNumber: string;
  houseNumberSuffix?: string;
  postalCode: string;
  city: string;
  country: string;
  /**
   * If you want to save additional drop off point data to the order, you can do so here.
   */
  additionalData?: unknown;
}

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomOrderFields {
    dropOffPointCarrier?: string;
    dropOffPointId?: string;
    dropOffPointName?: string;
    dropOffPointStreetLine1?: string;
    dropOffPointStreetLine2?: string;
    dropOffPointHouseNumber: string;
    dropOffPointHouseNumberSuffix: string;
    dropOffPointPostalCode: string;
    dropOffPointCity: string;
  }
}
