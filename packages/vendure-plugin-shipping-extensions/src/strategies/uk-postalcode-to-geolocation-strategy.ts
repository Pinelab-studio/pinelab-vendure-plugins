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
    orderAddress: OrderAddress
  ): Promise<GeoLocation | undefined> {
    if (!orderAddress?.postalCode) {
      return undefined;
    }
    const url = `${POSTCODES_URL}/${encodeURIComponent(
      orderAddress.postalCode
    )}`;
    const response = await fetch(url);
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`);
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseBody: any = await response.json();
    return {
      //eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      latitude: responseBody.result.latitude,
      //eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      longitude: responseBody.result.longitude,
    };
  }
}
