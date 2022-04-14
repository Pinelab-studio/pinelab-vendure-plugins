import { CMutatieRegel, OMut } from '../client';
import { Logger, Order } from '@vendure/core';
import { EBoekhoudenConfigEntity } from './e-boekhouden-config.entity';
import { loggerCtx } from '../constants';
import { OrderTaxSummary } from '@vendure/admin-ui/core';

const toPrice = (price: number) => (price / 100).toFixed(2);

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
    const totalInc = tax.taxTotal + tax.taxBase;
    return {
      BedragExclBTW: toPrice(tax.taxBase),
      BedragInclBTW: toPrice(totalInc),
      BedragBTW: toPrice(tax.taxTotal),
      BTWPercentage: String(tax.taxRate),
      TegenrekeningCode: config.contraAccount,
      BTWCode: this.getTax(tax.taxRate, tax.description),
      BedragInvoer: toPrice(totalInc),
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
