import {
  EventBus,
  ID,
  Logger,
  PLUGIN_INIT_OPTIONS,
  Product,
  ProductEvent,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantPrice,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { loggerCtx } from './constants';
import type { BulkUpdateOptions } from './variant-bulk-update.plugin';
import { In } from 'typeorm';
import { UpdateProductVariantInput } from '@vendure/common/lib/generated-types';

type ProductWithCustomFields = Product & {
  customFields?: Record<string, any>;
};

type ProductEventWithCustomFields = ProductEvent & {
  product: ProductWithCustomFields;
};

@Injectable()
export class BulkUpdateService implements OnApplicationBootstrap {
  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: BulkUpdateOptions
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.eventBus.ofType(ProductEvent).subscribe(async (event) => {
      if (event.type !== 'updated' && event.type !== 'created') {
        // We only handle updated and created events
        return;
      }
      const { product, ctx } = event as ProductEventWithCustomFields;
      // Bulk update price
      if (this.options.enablePriceBulkUpdate && product.customFields?.price) {
        await this.updatePriceOfVariants(
          ctx,
          product,
          product.customFields.price
        ).catch((e) => {
          Logger.error(
            `Error updating prices of variants for product '${product.id}': ${e?.message}`,
            loggerCtx
          );
        });
      }
      // Bulk update custom fields
      const shouldUpdateCustomFields = this.options.bulkUpdateCustomFields.find(
        (customFieldName) =>
          product.customFields?.[customFieldName] !== undefined
      );
      if (shouldUpdateCustomFields) {
        await this.updateCustomFieldsOfVariants(ctx, product).catch((e) => {
          Logger.error(
            `Error updating custom fields of variants for product '${product.id}': ${e?.message}`,
            loggerCtx
          );
        });
      }
    });
  }

  async updatePriceOfVariants(
    ctx: RequestContext,
    product: ProductWithCustomFields,
    price: number
  ): Promise<void> {
    const variants = await this.getAllVariantsForProduct(ctx, product.id);
    const variantIds = variants.map((v) => v.id);
    const res = await this.connection
      .getRepository(ctx, ProductVariantPrice)
      .createQueryBuilder('price')
      .update({
        price,
      })
      .where({
        variant: In(variantIds),
        channelId: ctx.channelId,
      })
      .execute();
    Logger.info(
      `Updated prices of ${res.affected} variants of product ${product.id} to ${product.customFields?.price}`,
      loggerCtx
    );
    await this.eventBus.publish(
      new ProductVariantEvent(ctx, variants, 'updated')
    );
  }

  /**
   * Update all configured custom fields of variants with the value of the product's custom fields
   */
  async updateCustomFieldsOfVariants(
    ctx: RequestContext,
    updatedProduct: ProductWithCustomFields
  ): Promise<void> {
    // First construct the custom fields update object for each configured field
    const customFields: Record<string, any> = {};
    for (const customFieldName of this.options.bulkUpdateCustomFields) {
      if (updatedProduct.customFields?.[customFieldName] !== undefined) {
        customFields[customFieldName] =
          updatedProduct.customFields[customFieldName];
      }
    }
    // Then we update all variants with the given custom field values
    const variants = await this.getAllVariantsForProduct(
      ctx,
      updatedProduct.id
    );
    const variantIds = variants.map((v) => v.id);
    const res = await this.connection
      .getRepository(ctx, ProductVariant)
      .createQueryBuilder('variant')
      .update({
        customFields,
      })
      .where({
        id: In(variantIds),
      })
      .execute();
    Logger.info(
      `Updated custom fields '${this.options.bulkUpdateCustomFields.join(
        ','
      )}' of ${res.affected} variants of product ${updatedProduct.id}`,
      loggerCtx
    );
    const inputs: UpdateProductVariantInput[] = variants.map((v) => ({
      id: v.id,
      customFields,
    }));
    await this.eventBus.publish(
      new ProductVariantEvent(ctx, variants, 'updated', inputs)
    );
  }

  private getAllVariantsForProduct(
    ctx: RequestContext,
    productId: ID
  ): Promise<ProductVariant[]> {
    return this.connection
      .getRepository(ctx, ProductVariant)
      .createQueryBuilder('variant')
      .select(['variant.id'])
      .where('variant.productId = :productId', { productId })
      .getMany();
  }
}
