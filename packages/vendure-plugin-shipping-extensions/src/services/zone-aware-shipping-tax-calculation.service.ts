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

  async getTaxRateWithCategory(
    ctx: RequestContext,
    order: Order,
    taxCategoryId: ID
  ): Promise<number | undefined> {
    const taxRateRepo = this.connection.getRepository(ctx, TaxRate);
    const countryCode =
      order?.billingAddress?.countryCode ?? order?.shippingAddress?.countryCode;
    const taxRate = await taxRateRepo.findOne({
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
    if (!taxRate) {
      Logger.error(
        `No tax rate found for country ${countryCode} having TaxCategory(${taxCategoryId})`,
        loggerCtx
      );
    }
    return taxRate?.value;
  }
}
