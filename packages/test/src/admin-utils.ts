import {
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
  variantIdCollectionFilter,
} from '@vendure/core';
import { Fulfillment } from '@vendure/common/lib/generated-types';
import { SimpleGraphQLClient } from '@vendure/testing';
import {
  CreateFulfillment,
  CreateShippingMethod,
  Order as OrderGraphql,
  Orders as OrdersGraphql,
  OrderQuery,
  OrdersQuery,
  ProductOption,
  ProductOptionGroup,
  GET_COLLECTION_ADMIN,
  QueryCollectionArgs,
  MutationUpdateCollectionArgs,
  ConfigArg,
  ConfigurableOperation,
  CreateCollectionInput,
  MutationCreateCollectionArgs,
  CREATE_COLLECTION,
  LanguageCode,
  Collection,
  CreateCollectionTranslationInput,
  Product,
  MutationCreateProductArgs,
  ProductTranslationInput,
  CreateProductOptionGroupInput,
  MutationCreateProductOptionGroupArgs,
  CREATE_PRODUCT_OPTION_GROUP,
  ADD_OPTION_GROUP_TO_PRODUCT,
  MutationAddOptionGroupToProductArgs,
  ProductVariant,
  MutationCreateProductVariantsArgs,
  CREATE_PRODUCT_VARIANTS,
  CREATE_PRODUCT,
  GlobalFlag,
  GET_ALL_COLLECTIONS,
} from './generated/admin-graphql';
import { productIdCollectionFilter } from '@vendure/core';

export async function addShippingMethod(
  adminClient: SimpleGraphQLClient,
  fulfillmentHandlerCode: string,
  price = '500'
) {
  await adminClient.asSuperAdmin();
  await adminClient.query(CreateShippingMethod, {
    input: {
      code: 'test-shipping-method',
      fulfillmentHandler: fulfillmentHandlerCode,
      checker: {
        code: defaultShippingEligibilityChecker.code,
        arguments: [
          {
            name: 'orderMinimum',
            value: '0',
          },
        ],
      },
      calculator: {
        code: defaultShippingCalculator.code,
        arguments: [
          {
            name: 'rate',
            value: price,
          },
          {
            name: 'taxRate',
            value: '0',
          },
        ],
      },
      translations: [
        { languageCode: LanguageCode.En, name: 'test method', description: '' },
      ],
    },
  });
}

export async function fulfill(
  adminClient: SimpleGraphQLClient,
  handlerCode: string,
  items: [variantId: string, quantity: number][],
  args?: { name: string; value: string }[]
): Promise<Fulfillment> {
  const lines = items.map((item) => ({
    orderLineId: item[0],
    quantity: item[1],
  }));
  const { addFulfillmentToOrder } = await adminClient.query(CreateFulfillment, {
    input: {
      lines,
      handler: {
        code: handlerCode,
        arguments: args || {},
      },
    },
  });
  return addFulfillmentToOrder;
}

export async function getOrder(
  adminClient: SimpleGraphQLClient,
  orderId: string
): Promise<OrderQuery['order']> {
  const { order } = await adminClient.query(OrderGraphql, { id: orderId });
  return order;
}

export async function getAllOrders(
  adminClient: SimpleGraphQLClient
): Promise<OrdersQuery['orders']['items']> {
  const { orders } = await adminClient.query(OrdersGraphql);
  return orders.items;
}

export async function assignProductToCollection(
  adminClient: SimpleGraphQLClient,
  productId: string,
  collectionId: string
): Promise<void> {
  const collection = await adminClient.query<Collection, QueryCollectionArgs>(
    GET_COLLECTION_ADMIN,
    { id: collectionId }
  );
  const productIdConfigurableOperation: ConfigurableOperation | undefined =
    collection.filters.find((f) => f.code === productIdCollectionFilter.code);
  let updatedCollectionFilter: ConfigurableOperation[];
  if (productIdConfigurableOperation) {
    if (
      productIdConfigurableOperation.args.find((a) => a.value === productId)
    ) {
      return;
    }
    const updatedproductIdCollectionFilterArgs = [
      ...(productIdConfigurableOperation.args as ConfigArg[]),
      {
        name: 'productIds',
        value: productId,
      },
    ];
    updatedCollectionFilter = [
      ...collection.filters.filter(
        (f) => f.code !== productIdCollectionFilter.code
      ),
      {
        code: productIdCollectionFilter.code,
        args: updatedproductIdCollectionFilterArgs,
      },
    ];
  } else {
    const updatedproductIdCollectionFilterArgs = [
      {
        name: 'productIds',
        value: productId,
      },
    ];
    updatedCollectionFilter = [
      ...collection.filters.filter(
        (f) => f.code !== productIdCollectionFilter.code
      ),
      {
        code: productIdCollectionFilter.code,
        args: updatedproductIdCollectionFilterArgs,
      },
    ];
  }
  const updateCollectionInput: MutationUpdateCollectionArgs = {
    input: {
      id: collectionId,
      filters: updatedCollectionFilter.map((f) => {
        return {
          code: f.code,
          arguments: f.args,
        };
      }),
    },
  };
}

export async function createCollectionContainingVariants(
  adminClient: SimpleGraphQLClient,
  translationFields: Omit<
    CreateCollectionTranslationInput,
    'customFields' | 'languageCode'
  >,
  variantIds: string[],
  parentId?: string
): Promise<Collection> {
  const input: CreateCollectionInput = {
    filters: [
      {
        code: variantIdCollectionFilter.code,
        arguments: [
          {
            name: 'variantIds',
            value: JSON.stringify(variantIds),
          },
          { name: 'combineWithAnd', value: 'true' },
        ],
      },
    ],
    translations: [
      {
        description: translationFields.description,
        languageCode: LanguageCode.En,
        name: translationFields.name,
        slug: translationFields.slug,
      },
    ],
    parentId,
  };
  return (
    (await adminClient.query<Collection, MutationCreateCollectionArgs>(
      CREATE_COLLECTION,
      { input }
    )) as any
  ).createCollection;
}

export async function createProduct(
  adminClient: SimpleGraphQLClient,
  translationFields: Omit<
    ProductTranslationInput,
    'customFields' | 'languageCode'
  >
) {
  return (
    (await adminClient.query<Product, MutationCreateProductArgs>(
      CREATE_PRODUCT,
      {
        input: {
          translations: [
            {
              languageCode: LanguageCode.En,
              description: translationFields.description,
              name: translationFields.name,
              slug: translationFields.slug,
            },
          ],
        },
      }
    )) as any
  ).createProduct;
}

export async function assignOptionGroupsToProduct(
  adminClient: SimpleGraphQLClient,
  product: Product,
  optionGroups: CreateProductOptionGroupInput[]
): Promise<Product> {
  const createdOptionGroups: any[] = await Promise.all(
    optionGroups.map(async (g) => {
      return (
        (await adminClient.query<
          ProductOptionGroup,
          MutationCreateProductOptionGroupArgs
        >(CREATE_PRODUCT_OPTION_GROUP, {
          input: {
            code: g.code,
            options: g.options,
            translations: [
              {
                languageCode: LanguageCode.En,
                name: g.translations[0].name,
              },
            ],
          },
        })) as any
      ).createProductOptionGroup;
    })
  );
  let newProduct = product;
  for (const optionGroup of createdOptionGroups) {
    newProduct = (
      (await adminClient.query<Product, MutationAddOptionGroupToProductArgs>(
        ADD_OPTION_GROUP_TO_PRODUCT,
        {
          optionGroupId: optionGroup.id as string,
          productId: newProduct.id,
        }
      )) as any
    ).addOptionGroupToProduct;
  }
  return newProduct;
}

export async function createVariantsForProductOptions(
  adminClient: SimpleGraphQLClient,
  product: Product
): Promise<ProductVariant[]> {
  const crossJoinedOptions = combineProductOptions(
    product.optionGroups[0].options,
    product.optionGroups[1].options
  );
  const variants = await adminClient.query<
    ProductVariant[],
    MutationCreateProductVariantsArgs
  >(CREATE_PRODUCT_VARIANTS, {
    input: crossJoinedOptions.map((i: ProductOption[]) => {
      return {
        productId: product.id,
        price: 10000,
        stockOnHand: 100,
        sku: i.map((o) => o.code).join(' '),
        trackInventory: GlobalFlag.True,
        optionIds: i.map((o) => o.id),
        translations: [
          {
            languageCode: LanguageCode.En,
            name: `${product.translations[0].name} ${i
              .map((o) => o.code)
              .join(' ')}`,
          },
        ],
      };
    }),
  });
  return (variants as any).createProductVariants;
}

/**
 *
 * @param one The first product option group's option values
 * @param two The second product option group's option values
 * @returns
 */
function combineProductOptions(one: ProductOption[], two: ProductOption[]) {
  const crossJoined: ProductOption[][] = [];
  for (const a of one) {
    for (const b of two) {
      crossJoined.push([a, b]);
    }
  }
  return crossJoined;
}

export async function getAllCollections(adminClient: SimpleGraphQLClient) {
  return adminClient.query(GET_ALL_COLLECTIONS);
}
