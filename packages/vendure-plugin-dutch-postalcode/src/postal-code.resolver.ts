import { Args, Query, Resolver } from "@nestjs/graphql";
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  UnauthorizedError,
} from "@vendure/core";
import gql from "graphql-tag";
import { DutchPostalCodePlugin } from "./dutch-postal-code.plugin";
import fetch from "node-fetch";

interface DutchAddressLookupResult {
  postalCode: string;
  houseNumber: string;
  street: string;
  city: string;
  municipality?: string;
  province?: string;
  lat?: number;
  lon?: number;
}

@Resolver()
export class PostalCodeResolver {
  static schema = gql`
    extend type Query {
      dutchAddressLookup(input: DutchPostalCodeInput!): DutchAddressLookupResult
    }
    input DutchPostalCodeInput {
      postalCode: String!
      houseNumber: String!
    }
    type DutchAddressLookupResult {
      postalCode: String!
      houseNumber: String!
      street: String!
      city: String!
      municipality: String
      province: String
      lat: Float
      lon: Float
    }
  `;

  headers = {};

  constructor() {
    if (!DutchPostalCodePlugin.apiKey) {
      throw Error(
        `DutchPostalCodePlugin needs an apiKey. Use DutchPostalCodePlugin.init('yourkey') to set an apiKey`
      );
    }
    this.headers = {
      Authorization: `Bearer ${DutchPostalCodePlugin.apiKey}`,
    };
  }

  @Query()
  @Allow(Permission.Public)
  async dutchAddressLookup(
    @Ctx() ctx: RequestContext,
    @Args("input") input: { postalCode: string; houseNumber: string }
  ): Promise<DutchAddressLookupResult | undefined> {
    if (!ctx.channelId || !ctx.session?.token) {
      // A little sanity check if this call is from a storefront
      throw new UnauthorizedError();
    }
    const { postalCode, houseNumber } = input;
    const result = await fetch(
      `https://postcode.tech/api/v1/postcode/full?postcode=${postalCode}&number=${houseNumber}`,
      { headers: this.headers }
    );
    const jsonResult = await result.json();
    if (!jsonResult.street) {
      return undefined;
    }
    return {
      postalCode: jsonResult.postcode,
      houseNumber: jsonResult.number,
      street: jsonResult.street,
      city: jsonResult.city,
      municipality: jsonResult.municipality,
      province: jsonResult.province,
      lat: jsonResult.geo?.lat,
      lon: jsonResult.geo?.lon,
    };
  }
}
