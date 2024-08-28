import { Injectable } from '@nestjs/common';
import {
  ID,
  Logger,
  Order,
  RequestContext,
  TaxRate,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../constants';

@Injectable()
export class ZoneAwareShippingTaxCalculationService {
  constructor(private readonly connection: TransactionalConnection) {}

  /**
   * This resolves the given tax category to a tax rate based on the orders billing Address.
   * If no billing address, it used the shipping address
   */
  async getTaxRateForCategory(
    ctx: RequestContext,
    order: Order,
    taxCategoryId: ID
  ): Promise<number | undefined> {
    const countryCode =
      order?.billingAddress?.countryCode ?? order?.shippingAddress?.countryCode;
    const [defaultRate, rateForCountry] = await Promise.all([
      this.getDefaultTaxRate(ctx, taxCategoryId),
      countryCode && this.getTaxRateForCountry(ctx, taxCategoryId, countryCode),
    ]);
    if (rateForCountry) {
      return rateForCountry.value;
    } else if (defaultRate) {
      if (countryCode) {
        Logger.warn(
          `No tax rate found for '${order.code}' in country '${countryCode}' with tax category '${taxCategoryId}', using the channel's default tax rate '${defaultRate.value}'`,
          loggerCtx
        );
      }
      return defaultRate.value;
    } else {
      Logger.error(
        `No tax rate found for '${order.code}' in country '${countryCode}' with tax category '${taxCategoryId}'`,
        loggerCtx
      );
    }
  }

  private async getTaxRateForCountry(
    ctx: RequestContext,
    taxCategoryId: ID,
    countryCode: string
  ): Promise<TaxRate | null> {
    return await this.connection.getRepository(ctx, TaxRate).findOne({
      where: {
        zone: {
          members: {
            code: countryCode,
          },
        },
        category: {
          id: taxCategoryId,
        },
      },
    });
  }

  /**
   * Get the tax rate of the default zone
   */
  private async getDefaultTaxRate(
    ctx: RequestContext,
    taxCategoryId: ID
  ): Promise<TaxRate | null> {
    return await this.connection.getRepository(ctx, TaxRate).findOne({
      where: {
        zone: {
          id: ctx.channel.defaultTaxZone.id,
        },
        category: {
          id: taxCategoryId,
        },
      },
    });
  }
}
