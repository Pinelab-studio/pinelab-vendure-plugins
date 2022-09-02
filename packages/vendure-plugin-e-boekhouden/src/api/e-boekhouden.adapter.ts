import { CMutatieRegel, OMut } from '../client';
import { Logger, Order } from '@vendure/core';
import { EBoekhoudenConfigEntity } from './e-boekhouden-config.entity';
import { loggerCtx } from '../constants';
import { OrderTaxSummary } from '@vendure/common/lib/generated-types';

const toPrice = (price: number) => (Math.round(price) / 100).toFixed(2);

/**
 * Recalculate taxes based on the taxBase+taxTotal (the totalIncVAT), because Vendure calculates taxes per orderline and
 * EBoekhouden calculates taxes based on the total per taxRate.
 * This can result in small rounding differences
 * @param summary
 */
export const recalculateTaxFromTotalIncVAT = (summary: OrderTaxSummary) => {
  const taxMultiplier = summary.taxRate / 100 + 1;
  const totalIncVAT = summary.taxBase + summary.taxTotal;
  const totalExVAT = totalIncVAT / taxMultiplier;
  const totalTax = totalIncVAT - totalExVAT;
  return {
    totalIncVAT,
    totalExVAT,
    totalTax,
  };
};

export class EBoekhoudenAdapter {
  /**
   * Transforms an order, together with config, to a e-Boekhouden mutation format
   * using the order.taxSummary
   */
  static toMutation(order: Order, config: EBoekhoudenConfigEntity): OMut {
    const description = `Order ${order.code} - ${order.customer?.firstName} ${order.customer?.lastName} (${order.customer?.emailAddress})`;
    const cMutatieRegel = order.taxSummary.map((summary) =>
      this.toMutationLine(summary, config)
    );
    return {
      Soort: 'GeldOntvangen',
      Datum: this.toDateString(order.orderPlacedAt || order.updatedAt),
      Rekening: config.account,
      Omschrijving: description,
      InExBTW: 'IN',
      MutatieRegels: {
        cMutatieRegel,
      },
    };
  }

  static toMutationLine(
    tax: OrderTaxSummary,
    config: EBoekhoudenConfigEntity
  ): CMutatieRegel {
    const recalculatedTax = recalculateTaxFromTotalIncVAT(tax);
    return {
      BedragExclBTW: toPrice(recalculatedTax.totalExVAT),
      BedragInclBTW: toPrice(recalculatedTax.totalIncVAT),
      BedragBTW: toPrice(recalculatedTax.totalTax),
      BTWPercentage: String(tax.taxRate),
      TegenrekeningCode: config.contraAccount,
      BTWCode: this.getTax(tax.taxRate, tax.description),
      BedragInvoer: toPrice(recalculatedTax.totalIncVAT),
    };
  }

  static getTax(
    value: number,
    reference: string
  ): 'LAAG_VERK_9' | 'HOOG_VERK_21' | 'AFW' | 'GEEN' {
    if (value === 9) {
      return 'LAAG_VERK_9';
    } else if (value === 21) {
      return 'HOOG_VERK_21';
    } else if (value === 0) {
      return 'GEEN';
    } else {
      Logger.error(
        `Unknown taxValue ${value} for ${reference}. Used 21 as default`,
        loggerCtx
      );
      return 'HOOG_VERK_21';
    }
  }

  static toDateString(date: Date): string {
    const dateString = date.toISOString();
    return dateString.substr(0, 10);
  }
}
