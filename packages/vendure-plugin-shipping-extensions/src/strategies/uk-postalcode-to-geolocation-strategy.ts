import { UserInputError } from '@vendure/core';
import {
  OrderAddressToGeolocationConversionStrategy,
  GeoLocation,
} from './order-address-to-geolocation-strategy';
import { OrderAddress } from '@vendure/common/lib/generated-shop-types';

export const POSTCODES_URL = `https://postcodes.io/postcodes`;
export class UKPostalCodeToGelocationConversionStrategy
  implements OrderAddressToGeolocationConversionStrategy
{
  async getGeoLocationForAddress(
    orderAddress: OrderAddress,
  ): Promise<GeoLocation> {
    if (!orderAddress?.postalCode) {
      throw new Error(`Order Shipping Address postal code not found`);
    }
    const url = `${POSTCODES_URL}/${encodeURIComponent(
      orderAddress.postalCode,
    )}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseBody: any = await response.json();
    if (responseBody?.status !== 200) {
      throw new Error(responseBody?.error);
    }
    return {
      latitude: responseBody.result.latitude,
      longitude: responseBody.result.longitude,
    };
  }
}
