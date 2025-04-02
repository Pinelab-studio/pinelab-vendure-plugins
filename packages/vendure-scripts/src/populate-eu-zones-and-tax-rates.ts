import { INestApplication } from '@nestjs/common';
import {
  ID,
  Logger,
  RequestContextService,
  TaxRateService,
  Zone,
  ZoneService,
} from '@vendure/core';

const loggerCtx = 'PopulateZonesAndTaxRatesScript';

/**
 * Creates zones and tax rates for a shop operating in the EU.
 *
 * Assumes Countries and Tax Categories (zero, low, reduced) are already present.
 * Creates a zone for each country in the EU, with its corresponding tax rate.
 *
 * Only use this when your shop is using the One Stop Shop scheme: https://vat-one-stop-shop.ec.europa.eu/index_en
 * (This is the case when you have revenue over €10.000 to other EU countries besides your own country)
 *
 * Don't forget to install AddressBasedTaxZoneStrategy in your Vendure config: https://docs.vendure.io/reference/typescript-api/tax/address-based-tax-zone-strategy
 *
 * For B2B sales, you should set up Reverse Tax Charge. This is not included in this script.
 * Checkout Pinelab.studio/recipes on more information on how to set up reverse tax charge.
 */
export async function populateEuZonesAndTaxRates(
  app: INestApplication,
  taxCategories: { zero: ID; reduced: ID; standard: ID },
  channelToken?: string
): Promise<void> {
  const zoneService = app.get(ZoneService);
  const taxRateService = app.get(TaxRateService);
  const ctx = await app.get(RequestContextService).create({
    apiType: 'admin',
    channelOrToken: channelToken,
  });

  const existingZones = await zoneService.getAllWithMembers(ctx);
  const existingMembers = existingZones.map((zone) => zone.members).flat();

  // Create a zone for each country in the EU
  for (const {
    name,
    members: zoneMembers,
    zero,
    low,
    standard,
  } of zonesAndTaxRates) {
    const existingZone = existingZones.find((zone) => zone.name === name);
    const memberIds: ID[] = [];
    zoneMembers.forEach((zoneMemberCode) => {
      const existingMember = existingMembers.find(
        (existingMember) => existingMember.code === zoneMemberCode
      );
      if (!existingMember) {
        Logger.error(
          `Country ${zoneMemberCode} does not exist, you should manually create it and add it as member to zone '${name}'`,
          loggerCtx
        );
        return;
      }
      memberIds.push(existingMember.id);
    });
    let zone: Zone;
    if (existingZone) {
      Logger.info(
        `Zone ${name} already exists, updating it's members`,
        loggerCtx
      );
      zone = await zoneService.addMembersToZone(ctx, {
        zoneId: existingZone.id,
        memberIds,
      });
    } else {
      zone = await zoneService.create(ctx, {
        name,
        memberIds,
      });
    }

    // Create the corresponding tax rates for each zone
    for (const [i, value] of [zero, low, standard].entries()) {
      // Display name
      const rateName = i === 0 ? 'Zero' : i === 1 ? 'Reduced' : 'Standard';
      // Category name to get the category ID
      const categoryName: 'zero' | 'reduced' | 'standard' =
        i === 0 ? 'zero' : i === 1 ? 'reduced' : 'standard';
      const categoryId: ID = taxCategories[categoryName];
      if (!categoryId) {
        Logger.error(
          `Tax category ${rateName} does not exist, you should manually create it and add it as member to zone '${name}'`,
          loggerCtx
        );
        continue;
      }
      await taxRateService.create(ctx, {
        name: `${name} ${rateName}`,
        zoneId: zone.id,
        value,
        enabled: true,
        categoryId,
      });
      Logger.info(
        `Tax rate '${name} ${rateName}' created with value ${value}%`,
        loggerCtx
      );
    }
  }
}

const zonesAndTaxRates = [
  { name: 'Austria', members: ['AT'], zero: 0, low: 10, standard: 20 },
  { name: 'Belgium', members: ['BE'], zero: 0, low: 6, standard: 21 },
  { name: 'Bulgaria', members: ['BG'], zero: 0, low: 9, standard: 20 },
  { name: 'Croatia', members: ['HR'], zero: 0, low: 5, standard: 25 },
  { name: 'Cyprus', members: ['CY'], zero: 0, low: 5, standard: 19 },
  { name: 'Czech Republic', members: ['CZ'], zero: 0, low: 12, standard: 21 },
  { name: 'Denmark', members: ['DK'], zero: 0, low: 0, standard: 25 },
  { name: 'Estonia', members: ['EE'], zero: 0, low: 9, standard: 22 },
  { name: 'Finland', members: ['FI'], zero: 0, low: 10, standard: 25.5 },
  { name: 'France', members: ['FR'], zero: 0, low: 5.5, standard: 20 },
  { name: 'Germany', members: ['DE'], zero: 0, low: 7, standard: 19 },
  { name: 'Greece', members: ['GR'], zero: 0, low: 6, standard: 24 },
  { name: 'Hungary', members: ['HU'], zero: 0, low: 5, standard: 27 },
  { name: 'Ireland', members: ['IE'], zero: 0, low: 9, standard: 23 },
  { name: 'Italy', members: ['IT'], zero: 0, low: 5, standard: 22 },
  { name: 'Latvia', members: ['LV'], zero: 0, low: 5, standard: 21 },
  { name: 'Lithuania', members: ['LT'], zero: 0, low: 5, standard: 21 },
  { name: 'Luxembourg', members: ['LU'], zero: 0, low: 8, standard: 17 },
  { name: 'Malta', members: ['MT'], zero: 0, low: 5, standard: 18 },
  { name: 'Netherlands', members: ['NL'], zero: 0, low: 9, standard: 21 },
  { name: 'Poland', members: ['PL'], zero: 0, low: 5, standard: 23 },
  { name: 'Portugal', members: ['PT'], zero: 0, low: 6, standard: 23 },
  { name: 'Romania', members: ['RO'], zero: 0, low: 5, standard: 19 },
  { name: 'Slovakia', members: ['SK'], zero: 0, low: 5, standard: 23 },
  { name: 'Slovenia', members: ['SI'], zero: 0, low: 5, standard: 22 },
  { name: 'Spain', members: ['ES'], zero: 0, low: 10, standard: 21 },
  { name: 'Sweden', members: ['SE'], zero: 0, low: 6, standard: 25 },
  {
    name: 'Europe, outside of the EU',
    members: [
      'AL', // Albania
      'AD', // Andorra
      'BA', // Bosnia and Herzegovina
      'BY', // Belarus
      'CH', // Switzerland
      'IS', // Iceland
      'KS', // Kosovo
      'LI', // Liechtenstein
      'MD', // Moldova
      'MC', // Monaco
      'ME', // Montenegro
      'MK', // North Macedonia
      'NO', // Norway
      'RS', // Serbia
      'SM', // San Marino
      'TR', // Turkey
      'UA', // Ukraine
      'VA', // Vatican City
    ],
    zero: 0,
    low: 0,
    standard: 0,
  },
];
