import { OrderAddress } from '@vendure/common/lib/generated-types';
import { RequestContext } from '@vendure/core';
import { AddressLookupInput } from '../generated/graphql';
import { AddressLookupStrategy } from '../types';
import {
  normalizePostalCode,
  validateDutchPostalCode,
} from './validation-util';

interface BAGLookupInput {
  apiKey: string;
}

/**
 * This strategy is used to lookup NL addresses via BAG API
 */
export class BAGLookupStrategy implements AddressLookupStrategy {
  readonly supportedCountryCodes = ['NL'];

  constructor(private readonly input: BAGLookupInput) {}

  validateInput(input: AddressLookupInput): true | string {
    return validateDutchPostalCode(input);
  }

  async lookup(
    ctx: RequestContext,
    input: AddressLookupInput
  ): Promise<OrderAddress[]> {
    const postalCode = normalizePostalCode(input.postalCode!);
    const houseNumber = parseInt(input.houseNumber!);
    const url = `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressen?postcode=${postalCode}&huisnummer=${houseNumber}`;
    const result = await fetch(url, {
      headers: {
        'X-Api-Key': this.input.apiKey,
      },
    });

    if (!result.ok) {
      throw new Error(`${result.status}: ${await result.text()}`);
    }

    const jsonResult = (await result.json()) as BAGResponse;
    if (!jsonResult._embedded?.adressen?.length) {
      return [];
    }
    return jsonResult._embedded.adressen
      .slice(0, 1) // Slice, because BAG lookup by house number and postal code always returns 1 street, but can have multiple results because of diverging house number formats
      .map((result) => ({
        streetLine1: result.openbareRuimteNaam,
        streetLine2: input.houseNumber!,
        city: result.woonplaatsNaam,
        postalCode: result.postcode,
        country: 'Netherlands',
        countryCode: 'NL',
      }));
  }
}

export interface BAGResponse {
  _links: {
    self: { href: string };
  };
  _embedded: {
    adressen: {
      openbareRuimteNaam: string;
      korteNaam: string;
      huisnummer: number;
      huisletter?: string;
      huisnummertoevoeging?: string;
      postcode: string;
      woonplaatsNaam: string;
      nummeraanduidingIdentificatie: string;
      openbareRuimteIdentificatie: string;
      woonplaatsIdentificatie: string;
      adresseerbaarObjectIdentificatie: string;
      pandIdentificaties: string[];
      adresregel5: string;
      adresregel6: string;
      _links: {
        self: { href: string };
        openbareRuimte: { href: string };
        nummeraanduiding: { href: string };
        woonplaats: { href: string };
        adresseerbaarObject: { href: string };
        panden: Array<{ href: string }>;
      };
    }[];
  };
}
