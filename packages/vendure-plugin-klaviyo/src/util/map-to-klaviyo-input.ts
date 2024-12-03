import { uniq } from 'lodash';
import {
  KlaviyoGenericEvent,
  KlaviyoOrderItem,
  KlaviyoOrderPlacedEvent,
} from '../event-handler/klaviyo-event-handler';
import {
  EventCreateQueryV2,
  EventCreateQueryV2ResourceObjectAttributesProfile,
  OnsiteProfileCreateQueryResourceObjectAttributes,
} from 'klaviyo-api';
import { phone } from 'phone';
import { Logger } from '@vendure/core';
import { loggerCtx } from '../constants';

/**
 * Returns a valid E.164 formatted phone number, or undefined if we can't format the phonenumber to E.164.
 * If no countryCode is provided, we try to parse the phonenumber as NL number
 */
function getE164PhoneNumber(
  phoneNumberString?: string,
  countryCode = 'NL'
): string | undefined {
  if (!phoneNumberString) {
    return undefined;
  }
  const { isValid, phoneNumber } = phone(phoneNumberString, {
    country: countryCode,
  });
  if (isValid) {
    return phoneNumber;
  }
  Logger.info(
    `Not sending invalid phone number '${phoneNumberString}' to Klaviyo`,
    loggerCtx
  );
}

/**
 * Map the profile defined by the plugin consumer to the expected Klaviyo API input
 */
function mapToProfile(
  eventProfile: KlaviyoGenericEvent['profile']
): EventCreateQueryV2ResourceObjectAttributesProfile {
  const profile: OnsiteProfileCreateQueryResourceObjectAttributes = {
    email: eventProfile.emailAddress,
    externalId: eventProfile.externalId,
    firstName: eventProfile.firstName,
    lastName: eventProfile.lastName,
    phoneNumber: getE164PhoneNumber(
      eventProfile.phoneNumber,
      eventProfile.address?.countryCode
    ),
    properties: {
      ...eventProfile.customProperties,
    },
    location: {
      ...eventProfile.address,
      country: eventProfile.address?.countryCode,
    },
  };
  return {
    data: {
      type: 'profile',
      attributes: profile,
    },
  };
}

/**
 * Map the KlaviyoOrderPlacedEvent defined by the plugin consumer to the expected Klaviyo API input
 */
export function mapToKlaviyoOrderPlacedInput(
  event: KlaviyoOrderPlacedEvent
): EventCreateQueryV2 {
  const collections = uniq(
    event.orderItems
      .map((item) => item.Categories)
      .flat()
      .filter(Boolean)
  );
  const brands = uniq(
    event.orderItems.map((item) => item.Brand).filter(Boolean)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderProperties: Record<string, any> = {
    OrderId: event.orderId,
    Categories: collections,
    ItemNames: event.orderItems.map((item) => item.ProductName),
    Brands: brands,
    Items: event.orderItems.map((item) => ({
      ...item,
      ItemPrice: item.ItemPrice,
      RowTotal: item.RowTotal,
    })),
  };
  if (event.discountCode) {
    orderProperties.DiscountCode = event.discountCode;
  }
  if (event.customProperties) {
    orderProperties.CustomProperties = event.customProperties;
  }
  return {
    data: {
      type: 'event',
      attributes: {
        uniqueId: event.uniqueId,
        properties: orderProperties,
        time: new Date(event.orderPlacedAt), // Date was stringified via Job queue
        value: event.totalOrderValue,
        metric: {
          data: {
            type: 'metric',
            attributes: {
              name: 'Placed Order',
            },
          },
        },
        profile: mapToProfile(event.profile),
      },
    },
  };
}

/**
 * Map the consumer defined event to the expected Klaviyo API event input
 */
export function mapToKlaviyoEventInput(
  event: KlaviyoGenericEvent
): EventCreateQueryV2 {
  return {
    data: {
      type: 'event',
      attributes: {
        uniqueId: event.uniqueId,
        profile: mapToProfile(event.profile),
        metric: {
          data: {
            type: 'metric',
            attributes: {
              name: event.eventName,
            },
          },
        },
        properties: event.customProperties ?? {},
      },
    },
  };
}

/**
 * Map each given order item to an Ordered Product event
 */
export function mapToOrderedProductEvent(
  orderItem: KlaviyoOrderItem,
  /**
   * Used to identify (and make unique) the order item in the context of the order
   */
  orderItemNr: number,
  orderEvent: KlaviyoOrderPlacedEvent
): EventCreateQueryV2 {
  return {
    data: {
      type: 'event',
      attributes: {
        uniqueId: `${orderEvent.uniqueId}_${orderItemNr}`,
        properties: {
          ...orderItem,
          ItemPrice: orderItem.ItemPrice,
          RowTotal: orderItem.RowTotal,
        },
        time: new Date(orderEvent.orderPlacedAt), // Date was stringified via Job queue
        value: orderItem.RowTotal,
        metric: {
          data: {
            type: 'metric',
            attributes: {
              name: 'Ordered Product',
            },
          },
        },
        profile: mapToProfile(orderEvent.profile),
      },
    },
  };
}
