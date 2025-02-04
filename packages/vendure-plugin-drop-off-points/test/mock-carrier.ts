import { RequestContext } from '@vendure/core';
import {
  DropOffPoint,
  DropOffPointCarrier,
  ParcelDropOffPointSearchInput,
} from '../src';

export class MockCarrier implements DropOffPointCarrier {
  name = 'mock';

  async getDropOffPoints(
    ctx: RequestContext,
    input: ParcelDropOffPointSearchInput
  ): Promise<DropOffPoint[]> {
    return [
      {
        dropOffPointId: 'mock-id',
        name: 'mock drop off point 𝓧', // Crazy character to test correct decoding
        houseNumber: input.houseNumber ?? 'mock nr',
        streetLine1: 'mock street',
        streetLine2: 'mock street 2',
        postalCode: input.postalCode,
        city: 'mock city',
        country: 'NL',
      },
    ];
  }
}
