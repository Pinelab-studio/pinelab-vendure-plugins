import { Injector, Order, OrderLine, RequestContext } from '@vendure/core';
import { ParcelInput, ParcelInputItem } from './sendcloud-api.types';

export interface SendcloudParcelStatus {
  id: number;
  message: string;
  /**
   * Corresponding orderState for the sendcloud status
   */
  orderState?: 'Shipped' | 'Delivered' | 'Cancelled';
}

export const sendcloudStates: SendcloudParcelStatus[] = [
  {
    id: 62989,
    message: 'The package has been held at customs',
  },
  {
    id: 6,
    message: 'Not sorted',
    orderState: 'Shipped',
  },
  {
    id: 15,
    message: 'Error collecting',
  },
  {
    id: 62990,
    message: 'The package is in the sorting centre',
    orderState: 'Shipped',
  },
  {
    id: 62991,
    message: 'The package was refused by the recipient when delivered',
  },
  {
    id: 62992,
    message: 'The package was returned to the sender due to an issue',
  },
  {
    id: 62993,
    message:
      'The delivery method was changed by the request of the recipient or due to other circumstances.',
  },
  {
    id: 1002,
    message: 'Announcement failed',
  },
  {
    id: 1999,
    message: 'Cancellation requested',
  },
  {
    id: 62994,
    message:
      'The delivery date was changed by the request of the recipient or due to other.',
  },
  {
    id: 62995,
    message:
      'The delivery address was changed by the request of the recipient or due to other circumstances.',
  },
  {
    id: 62996,
    message: 'For unusual cases: lost, damaged, destroyed, etc.',
  },
  {
    id: 1998,
    message: 'Cancelled upstream',
    orderState: 'Cancelled',
  },
  {
    id: 1000,
    message: 'Ready to send',
    orderState: 'Shipped',
  },
  {
    id: 62997,
    message:
      'The address is incorrect and the carrier needs address correction from the sender or the recipient.',
  },
  {
    id: 12,
    message: 'Awaiting customer pickup',
    orderState: 'Shipped',
  },
  {
    id: 11,
    message: 'Delivered',
    orderState: 'Delivered',
  },
  {
    id: 93,
    message: 'Shipment collected by customer',
    orderState: 'Delivered',
  },
  {
    id: 91,
    message: 'Parcel en route',
    orderState: 'Shipped',
  },
  {
    id: 80,
    message: 'Unable to deliver',
  },
  {
    id: 22,
    message: 'Shipment picked up by driver',
    orderState: 'Shipped',
  },
  {
    id: 13,
    message: 'Announced: not collected',
  },
  {
    id: 8,
    message: 'Delivery attempt failed',
  },
  {
    id: 7,
    message: 'Being sorted',
    orderState: 'Shipped',
  },
  {
    id: 5,
    message: 'Sorted',
    orderState: 'Shipped',
  },
  {
    id: 4,
    message: 'Delivery delayed',
  },
  {
    id: 3,
    message: 'En route to sorting center',
    orderState: 'Shipped',
  },
  {
    id: 1,
    message: 'Announced',
    orderState: 'Shipped',
  },
  {
    id: 1337,
    message:
      'Unknown status - check carrier track & trace page for more insights',
  },
  {
    id: 999,
    message: 'No label',
  },
  {
    id: 1001,
    message: 'Being announced',
    orderState: 'Shipped',
  },
  {
    id: 2000,
    message: 'Cancelled',
    orderState: 'Cancelled',
  },
  {
    id: 2001,
    message: 'Submitting cancellation request',
  },
  {
    id: 92,
    message: 'Driver en route',
    orderState: 'Shipped',
  },
];

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
