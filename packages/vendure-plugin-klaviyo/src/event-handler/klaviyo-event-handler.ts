import {
  Injector,
  OrderPlacedEvent,
  RequestContext,
  Type,
  VendureEvent,
} from '@vendure/core';

export declare type EventWithContext = VendureEvent & {
  ctx: RequestContext;
};

export interface KlaviyoOrderItem {
  ProductID: string;
  SKU: string;
  ProductName: string;
  Quantity: number;
  ItemPrice: number;
  RowTotal: number;
  ProductURL?: string;
  ImageURL?: string;
  Categories?: string[];
  Brand?: string;
  customProperties?: CustomProperties;
  /**
   * Setting this to true will exclude this item from being sent as Ordered Product event to Klaviyo.
   */
  excludeFromOrderedProductEvent?: boolean;
}

type CustomProperties = Record<string, string | string[] | number | boolean>;

/**
 * Use this interface to define custom events for Klaviyo.
 */
export interface KlaviyoGenericEvent {
  uniqueId: string;
  eventName: string;
  profile: {
    emailAddress: string;
    externalId: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    /**
     * Custom profile properties to be sent to Klaviyo
     */
    customProperties?: CustomProperties;
    /**
     * The main or default address of the customer
     */
    address?: {
      address1?: string;
      address2?: string;
      city?: string;
      postalCode?: string;
      countryCode?: string;
    };
  };
  customProperties?: CustomProperties;
}

/**
 * Use this interface to define a Placed Order Event for Klaviyo.
 * https://developers.klaviyo.com/en/docs/guide_to_integrating_a_platform_without_a_pre_built_klaviyo_integration#placed-order
 */
export interface KlaviyoOrderPlacedEvent extends KlaviyoGenericEvent {
  eventName: 'Order Placed';
  orderId: string;
  orderPlacedAt: Date;
  /**
   * In major values, i.e. whole dollars or euros
   */
  totalOrderValue: number;
  orderItems: KlaviyoOrderItem[];
}

/**
 * Map a Vendure event to a Klaviyo event.
 * Returning 'false' will ignore the event, thus not sending anything to Klaviyo.
 */
export type KlaviyoEventMapFn<
  EventType extends EventWithContext,
  ReturnType
> = (
  event: EventType,
  injector: Injector
) => Promise<ReturnType | false> | ReturnType | false;

export interface KlaviyoEventHandler<T extends EventWithContext> {
  /**
   * The Vendure event type to listen for
   */
  vendureEvent: Type<T>;
  /**
   * The function that maps the Vendure event to a Klaviyo event
   */
  mapToKlaviyoEvent: KlaviyoEventMapFn<T, KlaviyoGenericEvent>;
}

export interface KlaviyoOrderPlacedEventHandler
  extends KlaviyoEventHandler<OrderPlacedEvent> {
  mapToKlaviyoEvent: KlaviyoEventMapFn<
    OrderPlacedEvent,
    KlaviyoOrderPlacedEvent
  >;
}
