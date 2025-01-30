import { RequestContext } from '@vendure/core';
import { DropOffPoint, DropOffPointCarrier } from '../types';
import { ParcelDropOffPointSearchInput } from '../types-generated-graphql';

export class DHLCarrier implements DropOffPointCarrier {
  readonly name = 'DHL';

  constructor(private readonly countryCode = 'NL') {}

  async getDropOffPoints(
    ctx: RequestContext,
    input: ParcelDropOffPointSearchInput
  ): Promise<DropOffPoint[]> {
    let url = `https://api-gw.dhlparcel.nl/parcel-shop-locations/${
      this.countryCode
    }?limit=10&postalCode=${encodeURIComponent(
      input.postalCode
    )}&showUnavailable=false`;
    if (input.houseNumber) {
      url += `&houseNumber=${input.houseNumber}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch DHL drop-off points: [${response.status}] ${response.statusText}`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const points: DHLDropOffPoint[] = (await response.json()) as any;
    return points.map((point) => ({
      dropOffPointId: point.id,
      name: point.name,
      houseNumber: point.address.number,
      houseNumberSuffix: point.address.addition,
      streetLine1: point.address.street,
      streetLine2: undefined,
      postalCode: point.address.postalCode,
      city: point.address.city,
      country: point.address.countryCode,
      cutOffTime: point.collectionSchedule.time,
      latitude: point.geoLocation.latitude,
      longitude: point.geoLocation.longitude,
      distanceInKm: point.distance,
    }));
  }
}

interface DHLDropOffPoint {
  id: string;
  harmonisedId: string;
  psfKey: string;
  shopType: string;
  name: string;
  keyword: string;
  address: Address;
  geoLocation: GeoLocation;
  distance: number;
  openingTimes: OpeningTime[];
  collectionSchedule: CollectionSchedule;
  serviceTypes: string[];
  depotCode: string;
  allowNrParcels: string;
  servicepointFormat: string;
}

interface Address {
  countryCode: string;
  zipCode: string;
  city: string;
  street: string;
  number: string;
  addition?: string;
  isBusiness: boolean;
  postalCode: string;
}

interface GeoLocation {
  latitude: number;
  longitude: number;
}

interface OpeningTime {
  timeFrom: string;
  timeTo: string;
  weekDay: number;
}

interface CollectionSchedule {
  frequency: string;
  time: string;
}
