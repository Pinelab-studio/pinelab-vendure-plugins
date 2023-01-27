import {
  EventBus,
  LanguageCode,
  Logger,
  PluginCommonModule,
  ProductEvent,
  ProductVariant,
  ProductVariantService,
  TransactionalConnection,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { OnModuleInit } from '@nestjs/common';
import { filter } from 'rxjs/operators';

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
            "Set the price of all variants using this field. Leave it empty if you don't want to update all variants",
        },
      ],
      ui: { tab: 'Bulk update', component: 'currency-form-input' },
    });
    return config;
  },
})
export class VariantBulkUpdatePlugin implements OnModuleInit {
  constructor(
    private eventBus: EventBus,
    private variantService: ProductVariantService,
    private connection: TransactionalConnection
  ) {}

  async onModuleInit(): Promise<void> {
    this.eventBus
      .ofType(ProductEvent)
      .pipe(
        filter((event) => event.type === 'updated' || event.type === 'created')
      )
      .subscribe(async (event) => {
        const { product, ctx } = event as ProductEventWithCustomFields;
        if (product.customFields.price) {
          console.log(`Updating price top ${product.customFields.price}`);
          const variantIds = await this.connection
            .getRepository(ctx, ProductVariant)
            .createQueryBuilder('variant')
            .select(['variant.id'])
            .where('variant.productId = :productId', { productId: product.id })
            .getMany();
          console.log('IDS', variantIds);

          Logger.info(
            `Updated prices of all variants of product ${product.id} to ${product.customFields.price}`
          );
          //this.variantService.update(ctx, []);
        }
      });
  }
}
