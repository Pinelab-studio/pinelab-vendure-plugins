import { type Fulfillment } from '@vendure/common/lib/generated-types';
import {
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
} from '@vendure/core';
import { type SimpleGraphQLClient } from '@vendure/testing';
import {
  CreateCollection,
  type CreateCollectionInput,
  type CreateCollectionMutation,
  type CreateCollectionMutationVariables,
  CreateFulfillment,
  CreateShippingMethod,
  GetVariants,
  type GetVariantsQuery,
  LanguageCode,
  Order as OrderGraphql,
  type OrderQuery,
  Orders as OrdersGraphql,
  type OrdersQuery,
  UpdateProduct,
  type UpdateProductInput,
  type UpdateProductMutation,
  type UpdateProductVariantInput,
  UpdateProductVariants,
  type UpdateProductVariantsMutation,
} from './generated/admin-graphql';

export async function addShippingMethod(
  adminClient: SimpleGraphQLClient,
  fulfillmentHandlerCode: string,
  price = '500'
): Promise<void> {
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
  items: Array<[variantId: string, quantity: number]>,
  args?: Array<{ name: string; value: string }>
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
        arguments: args != null || {},
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

export async function updateVariants(
  adminClient: SimpleGraphQLClient,
  input: UpdateProductVariantInput[]
): Promise<UpdateProductVariantsMutation['updateProductVariants']> {
  const { updateProductVariants } = await adminClient.query(
    UpdateProductVariants,
    { input }
  );
  return updateProductVariants;
}

export async function updateProduct(
  adminClient: SimpleGraphQLClient,
  input: UpdateProductInput
): Promise<UpdateProductMutation['updateProduct']> {
  const { updateProduct } = await adminClient.query(UpdateProduct, {
    input,
  });
  return updateProduct;
}

export async function createCollection(
  adminClient: SimpleGraphQLClient,
  input: CreateCollectionInput
): Promise<CreateCollectionMutation['createCollection']> {
  const { createCollection } = await adminClient.query<
    CreateCollectionMutation,
    CreateCollectionMutationVariables
  >(CreateCollection, {
    input,
  });
  return createCollection;
}

export async function getAllOrders(
  adminClient: SimpleGraphQLClient
): Promise<OrdersQuery['orders']['items']> {
  const { orders } = await adminClient.query(OrdersGraphql);
  return orders.items;
}

export async function getAllVariants(
  adminClient: SimpleGraphQLClient
): Promise<GetVariantsQuery['productVariants']['items']> {
  const { productVariants } = await adminClient.query<GetVariantsQuery>(
    GetVariants
  );
  return productVariants.items;
}
