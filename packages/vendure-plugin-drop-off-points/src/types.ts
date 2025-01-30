import { Injector, RequestContext } from '@vendure/core';
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
   * If you already have custom fields, you can implement this function to set the drop off point on your order.
   * The plugin will then not add custom fields.
   */
  setDropOffPoint?: (
    ctx: RequestContext,
    injector: Injector,
    dropOffPoint: SelectedDropOffPoint
  ) => Promise<void>;
}

/**
 * The DropOff point that should be returned by a provider
 */
export type DropOffPoint = Omit<ParcelDropOffPoint, 'token'>;

export interface DropOffPointCarrier {
  name: string;
  getDropOffPoints: (
    input: ParcelDropOffPointSearchInput
  ) => Promise<DropOffPoint[]>;
}

export interface SelectedDropOffPoint {
  id: string;
  name: string;
  houseNumber: string;
  streetLine1: string;
  streetLine2?: string;
  postalCode: string;
  city: string;
  country: string;
}
