import {
  EventBus,
  LanguageCode,
  Logger,
  PluginCommonModule,
  ProductEvent,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantPrice,
  ProductVariantService,
  TransactionalConnection,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { OnModuleInit } from '@nestjs/common';
import { filter } from 'rxjs/operators';
import { In } from 'typeorm';

type ProductEventWithCustomFields = ProductEvent & {
  product: {
    customFields: {
      price: number;
    };
  };
};

const loggerCtx = 'VariantBulkUpdatePlugin';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
  configuration: (config) => {
    config.customFields.Product.push({
      name: 'price',
      type: 'int',
      public: true,
      nullable: true,
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Price',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Setting this field will update the variant prices everytime you update the product',
        },
      ],
      ui: { tab: 'Bulk update', component: 'currency-form-input' },
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class VariantBulkUpdatePlugin implements OnModuleInit {
  constructor(
    private eventBus: EventBus,
    private variantService: ProductVariantService,
    private connection: TransactionalConnection,
  ) {}

  async onModuleInit(): Promise<void> {
    this.eventBus
      .ofType(ProductEvent)
      .pipe(
        filter((event) => event.type === 'updated' || event.type === 'created'),
      )
      .subscribe(async (event) => {
        const { product, ctx } = event as ProductEventWithCustomFields;
        if (product.customFields?.price) {
          const variants = await this.connection
            .getRepository(ctx, ProductVariant)
            .createQueryBuilder('variant')
            .select(['variant.id'])
            .where('variant.productId = :productId', { productId: product.id })
            .getMany();
          const variantIds = variants.map((v) => v.id);
          const res = await this.connection
            .getRepository(ctx, ProductVariantPrice)
            .createQueryBuilder('price')
            .update({
              price: product.customFields.price,
            })
            .where({
              variant: In(variantIds),
              channelId: ctx.channelId,
            })
            .execute();
          Logger.info(
            `Updated prices of ${res.affected} variants of product ${product.id} to ${product.customFields.price}`,
            loggerCtx,
          );
          this.eventBus.publish(
            new ProductVariantEvent(ctx, variants, 'updated'),
          );
        }
      });
  }
}
