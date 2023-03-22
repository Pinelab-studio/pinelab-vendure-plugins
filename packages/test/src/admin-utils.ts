import {
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
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
  UpdateCollectionInput,
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

export async function createCollectionContainingProduct(
  adminClient: SimpleGraphQLClient,
  translationFields: Omit<
    CreateCollectionTranslationInput,
    'customFields' | 'languageCode'
  >,
  productId: string,
  parentId?: string
): Promise<Collection> {
  const input: CreateCollectionInput = {
    filters: [
      {
        code: productIdCollectionFilter.code,
        arguments: [{ name: 'productIds', value: productId }],
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
  return await adminClient.query<Collection, MutationCreateCollectionArgs>(
    CREATE_COLLECTION,
    { input }
  );
}
