# Vendure Drop Off Points Plugin

### [Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-drop-off-points)

Show nearby parcel drop off points to your customers. Supports multiple carriers and allows custom carriers. Also known as collection points or pickup points.

## Getting started

Add the plugin to your `vendure-config.ts`:

```ts
// vendure-config
import {
  DropOffPointsPlugin,
  DHLCarrier,
} from '@pinelab/vendure-plugin-drop-off-points';

plugins: [
  DropOffPointsPlugin.init({
    carriers: [
      new DHLCarrier(),
      // You can add more custom carriers here
    ],
  }),
];
```

Run a database migration to add the drop off point custom fields to an order. If you want to use your own custom fields, see "Using your own custom fields" below.

## Storefront usage

1. Fetch nearby drop off points:
   ```graphql
   query {
     parcelDropOffPoints(
       input: { carrier: "DHL", postalCode: "8932BR", houseNumber: "48" }
     ) {
       token
       dropOffPointId
       name
       streetLine1
       streetLine2
       postalCode
       houseNumber
       houseNumberSuffix
       city
       country
       latitude
       longitude
       distanceInKm
       cutOffTime
       additionalData
     }
   }
   ```
2. Set the selected drop off point on the order:
   ```graphql
   mutation {
    setParcelDropOffPoint(token: ${selectedPoint.token} ) {
        id
        code
        customFields {
        dropOffPointCarrier
        dropOffPointId
        dropOffPointName
        dropOffPointStreetLine1
        dropOffPointStreetLine2
        dropOffPointHouseNumber
        dropOffPointHouseNumberSuffix
        dropOffPointPostalCode
        dropOffPointCity
        dropOffPointCountry
        }
      }
    }
   ```
   If your customer decides to not use a drop off point, you should call `unsetParcelDropOffPoint` to void all the fields again.

## Using your own custom fields

By default, this plugin creates the following custom fields on an order: `dropOffPointCarrier, dropOffPointId, dropOffPointName, dropOffPointStreetLine1, dropOffPointStreetLine2, dropOffPointHouseNumber, dropOffPointHouseNumberSuffix, dropOffPointPostalCode, dropOffPointCity, dropOffPointCountry`.

If you would like to use your own custom fields for drop off points, you can implement the `setDropOffPointOnOrder` and `unsetDropOffPoint` functions, like so:

```ts
// vendure-config.ts

DropOffPointsPlugin.init({
  carriers: [new DHLCarrier()],
  // Use your own custom fields here
  customMutations: {
    setDropOffPointOnOrder: (ctx, order, dropOffPoint) => {
      order.customFields.pickupPointName = dropOffPoint.name;
      // Other fields go here
      return order;
    },
    unsetDropOffPoint: (ctx, order) => {
      order.customFields.pickupPointName = null;
      // Other fields go here
      return order;
    }
  }
}),
```

If you supply `customMutations` in the plugin config, you don't have to do a database migration, because the plugin will not add any custom fields to the order.

## Custom carriers

You can easily implement your own drop off point carriers, by implementing the `DropOffPointCarrier` interface.

```ts
// my-custom-carrier.ts

import { RequestContext } from '@vendure/core';
import {
  DropOffPoint,
  DropOffPointCarrier,
  ParcelDropOffPointSearchInput,
} from '@pinelab/vendure-plugin-drop-off-points';

export class CustomCarrier implements DropOffPointCarrier {
  readonly name = 'CustomCarrier';

  async getDropOffPoints(
    ctx: RequestContext,
    input: ParcelDropOffPointSearchInput
  ): Promise<DropOffPoint[]> {
    let url = `https://my-carrier-api.com/pickup-points=postalcode=${input.postalCode}`;
    if (input.houseNumber) {
      url += `&houseNumber=${input.houseNumber}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch drop-off points: [${response.status}] ${response.statusText}`
      );
    }
    const points = (await response.json()) as any;
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
```

You can then pass it into the plugin:

```ts
// vendure-config

plugins: [
  DropOffPointsPlugin.init({
    carriers: [new CustomCarrier()],
  }),
];
```

## Why are ID's/tokens so long?

TL;DR: Avoid an extra API call to drop off point carrier.

The drop off point's `token` is a base64 encoded string of the address details of a point. This is used to save the drop off point on an order when you call the `setParcelDropOffPoint` mutation, without the need to refetch the points from the external API.
