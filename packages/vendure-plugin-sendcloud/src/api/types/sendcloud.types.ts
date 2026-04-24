import { Injector, Order, OrderLine, RequestContext } from '@vendure/core';
import { ParcelInputItem } from './sendcloud-api.types';

export interface SendcloudPluginOptions {
  /**
   * Function to specify the weight of a parcelItem
   * based on the given orderLine
   */
  weightFn?: CustomFieldFn<number>;
  /**
   * Function to specify the hsCode for a parcelItem
   */
  hsCodeFn?: CustomFieldFn<string>;
  originCountryFn?: CustomFieldFn<string>;

  /**
   * You can send additional ParcelItems (rows) to SendCloud.
   * For example if you want the couponCodes applied on an order
   * also on your packaging slip in SendCloud
   */
  additionalParcelItemsFn?: AdditionalParcelInputFn;
  /**
   * Programatically disable the plugin. For example, when running in a test-env:
   * @example
   * disabled: !!process.env.TEST
   */
  disabled?: boolean;
}

export type AdditionalParcelInputFn = (
  ctx: RequestContext,
  injector: Injector,
  order: Order
) => Promise<ParcelInputItem[]>;

export type CustomFieldFn<T = string | number> = (
  /**
   * OrderLine with line.productVariant and line.productVariant.product
   */
  line: OrderLine
) => T;
