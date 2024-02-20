import { Address } from '@vendure/core';
import { OrderAddress } from '@vendure/common/lib/generated-shop-types';

export interface OrderAddressToGeolocationConversionStrategy {
  getGeoLocationForAddress: (
    orderAddress: OrderAddress,
  ) => Promise<GeoLocation>;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}
