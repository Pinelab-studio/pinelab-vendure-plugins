import { GraphqlQueries } from './queries';
import { GraphQLClient, Variables, gql } from 'graphql-request';
import { atom, WritableAtom } from 'nanostores';
import {
  ActiveOrderFieldsFragment,
  ActiveOrderQuery,
  AdditemToOrderMutation,
  AdditemToOrderMutationVariables,
  AdjustOrderLineMutation,
  AdjustOrderLineMutationVariables,
  ApplyCouponCodeResult,
  CreateAddressInput,
  CreateCustomerInput,
  Customer,
  ErrorResult,
  MutationApplyCouponCodeArgs,
  MutationRemoveCouponCodeArgs,
  MutationSetCustomerForOrderArgs,
  MutationSetOrderBillingAddressArgs,
  MutationSetOrderShippingAddressArgs,
  MutationSetOrderShippingMethodArgs,
  RemoveAllOrderLinesMutation,
  RemoveAllOrderLinesMutationVariables,
} from './graphql-types';
import mitt from 'mitt';
import { Id, VendureOrderEvents } from './vendure-order-events';

/**
 * Used when no additional fields are given
 */
const dummyFragment = gql`
  fragment AdditionalOrderFields on Order {
    id
  }
`;

export type ActiveOrder<T> = ActiveOrderFieldsFragment & T;
/**
 * OrderResult can be ActiveOrder or any extension of ErrorResult
 */
export type OrderResult<T> = ActiveOrder<T> | ErrorResult;

/**
 * @example
 * const client = new VendureOrderClient(
 *      'http://localhost:3050/shop-api',
 *      'channel-token',
 * );
 * Generic type A is the type of the additional fields that can be added to the order.
 */
export class VendureOrderClient<A = {}> {
  queries: GraphqlQueries;
  client: GraphQLClient;
  eventBus = mitt<VendureOrderEvents>();
  /**
   * The nanostore object that holds the active order.
   * For getting/setting the actual activeOrder, use `client.activeOrder`
   */
  activeOrderStore: WritableAtom<ActiveOrder<A> | undefined>;
  readonly tokenName = 'vendure-auth-token';

  get activeOrder(): ActiveOrder<A> | undefined {
    return this.activeOrderStore.get();
  }
  set activeOrder(order: ActiveOrder<A> | undefined) {
    this.activeOrderStore.set(order);
  }

  constructor(
    public url: string,
    public channelToken: string,
    public additionalOrderFields?: string
  ) {
    this.client = new GraphQLClient(url, {
      headers: { 'vendure-token': channelToken },
    });
    this.queries = new GraphqlQueries(additionalOrderFields ?? dummyFragment);
    this.activeOrderStore = atom<ActiveOrder<A> | undefined>(undefined);
  }

  async getActiveOrder(): Promise<ActiveOrder<A> | undefined> {
    const { activeOrder } = await this.rawRequest<ActiveOrderQuery>(
      this.queries.GET_ACTIVE_ORDER
    );
    this.activeOrder = activeOrder as ActiveOrder<A>;
    this.activeOrder = await this.validateOrder(activeOrder);
    return this.activeOrder;
  }

  async addItemToOrder(
    productVariantId: Id,
    quantity: number
  ): Promise<ActiveOrder<A> | undefined> {
    const { addItemToOrder } = await this.rawRequest<
      AdditemToOrderMutation,
      AdditemToOrderMutationVariables
    >(this.queries.ADD_ITEM_TO_ORDER, {
      productVariantId,
      quantity,
    });
    this.activeOrder = await this.validateOrder(addItemToOrder);
    this.eventBus.emit('item-added', {
      productVariantIds: [productVariantId],
      quantity,
    });
    return this.activeOrder;
  }

  async adjustOrderLine(
    orderLineId: Id,
    quantity: number
  ): Promise<ActiveOrder<A> | undefined> {
    const currentOrderLine = this.activeOrder?.lines.find(
      (line) => line.id === orderLineId
    );
    const currentQuantity = currentOrderLine?.quantity ?? 0;
    const { adjustOrderLine } = await this.rawRequest<
      AdjustOrderLineMutation,
      AdjustOrderLineMutationVariables
    >(this.queries.ADJUST_ORDERLINE, {
      orderLineId,
      quantity,
    });
    this.activeOrder = await this.validateOrder(adjustOrderLine);
    const adjustedOrderLine = this.activeOrder?.lines.find(
      (line) => line.id === orderLineId
    );
    const newQuantity = adjustedOrderLine?.quantity ?? 0;
    const adjustment = newQuantity - currentQuantity;
    // We assume either the current or the adjusted order line has a variant id
    const variantId = (currentOrderLine?.productVariant.id ||
      adjustedOrderLine?.productVariant.id)!;
    if (adjustment > 0) {
      this.eventBus.emit('item-added', {
        productVariantIds: [variantId],
        quantity: adjustment,
      });
    } else {
      this.eventBus.emit('item-removed', {
        productVariantIds: [variantId],
        quantity: -adjustment,
      });
    }
    return this.activeOrder;
  }

  async removeOrderLine(orderLineId: Id): Promise<ActiveOrder<A> | undefined> {
    return this.adjustOrderLine(orderLineId, 0);
  }

  async removeAllOrderLines(): Promise<ActiveOrder<A> | undefined> {
    const totalQuantity = this.activeOrder?.totalQuantity || 0;
    const productVariantIds =
      this.activeOrder?.lines.map((line) => line.productVariant.id) ?? [];
    const { removeAllOrderLines } = await this.rawRequest<
      RemoveAllOrderLinesMutation,
      RemoveAllOrderLinesMutationVariables
    >(this.queries.REMOVE_ALL_ORDERLINES);
    this.activeOrder = await this.validateOrder(removeAllOrderLines);
    this.eventBus.emit('item-removed', {
      productVariantIds,
      quantity: totalQuantity,
    });
    return this.activeOrder;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async rawRequest<T = void, I extends Variables | undefined = undefined>(
    document: string,
    variables?: I
  ): Promise<T> {
    if (window?.localStorage) {
      // Make sure we send auth token in request
      const token = window.localStorage.getItem(this.tokenName);
      if (token) {
        this.client.setHeader('Authorization', `Bearer ${token}`);
      }
    } else {
      console.error(`window.localStorage is not available`);
    }
    try {
      const { data, headers } = (await this.client.rawRequest(
        document,
        variables
      )) as any;
      const token = headers.get(this.tokenName);
      if (token && window?.localStorage) {
        // Make sure we save received tokens
        window.localStorage.setItem(this.tokenName, token);
      }
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Throws if order result contains an error, if not, returns the active order
   */
  async validateOrder(
    result?: ActiveOrderFieldsFragment | ErrorResult
  ): Promise<ActiveOrder<A> | undefined> {
    if (!result) {
      return;
    }
    if (result && (result as ErrorResult).errorCode) {
      const error = result as ErrorResult;
      if (
        error.errorCode === 'ORDER_MODIFICATION_ERROR' ||
        error.errorCode === 'ORDER_PAYMENT_STATE_ERROR'
      ) {
        window.localStorage.removeItem(this.tokenName); // These are unrecoverable states, so remove activeOrder
      }
      if (
        error.errorCode === 'INSUFFICIENT_STOCK_ERROR' ||
        error.errorCode === 'COUPON_CODE_INVALID_ERROR'
      ) {
        // Fetch activeOrder to get the current right amount of items per orderLine
        await this.getActiveOrder();
      }
      throw error;
    }
    // We've verified that result is not an error, so we can safely cast it
    return result as ActiveOrder<A>;
  }

  async applyCouponCode(
    couponCode: string
  ): Promise<ActiveOrder<A> | undefined> {
    try {
      const { applyCouponCode } = await this.rawRequest<
        any,
        MutationApplyCouponCodeArgs
      >(this.queries.APPLY_COUPON_CODE, { couponCode });
      this.activeOrder = await this.validateOrder(applyCouponCode);
      this.eventBus.emit('coupon-code-applied', {
        couponCode,
      });
      return this.activeOrder;
    } catch (e) {
      return this.activeOrder;
    }
  }

  async removeCouponCode(couponCode: string) {
    try {
      const { removeCouponCode } = await this.rawRequest<
        any,
        MutationRemoveCouponCodeArgs
      >(this.queries.REMOVE_COUPON_CODE, { couponCode });
      this.activeOrder = await this.validateOrder(removeCouponCode);
      this.eventBus.emit('coupon-code-removed', {
        couponCode,
      });
      return this.activeOrder;
    } catch (e) {
      return this.activeOrder;
    }
  }

  async createCustomer(
    input: CreateCustomerInput
  ): Promise<Customer | undefined> {
    const { setCustomerForOrder } = await this.rawRequest<
      any,
      MutationSetCustomerForOrderArgs
    >(this.queries.SET_CUSTOMER_FOR_ORDER, { input });
    this.activeOrder = await this.validateOrder(setCustomerForOrder);
    return setCustomerForOrder.customer;
  }

  async addShippingAddress(input: CreateAddressInput) {
    const { setOrderShippingAddress } = await this.rawRequest<
      any,
      MutationSetOrderShippingAddressArgs
    >(this.queries.SET_ORDER_SHIPPING_ADDRESS, { input });
    this.activeOrder = await this.validateOrder(setOrderShippingAddress);
    return setOrderShippingAddress.shippingAddress;
  }

  async addBillingAddress(input: CreateAddressInput) {
    const { setOrderBillingAddress } = await this.rawRequest<
      any,
      MutationSetOrderBillingAddressArgs
    >(this.queries.SET_ORDER_BILLING_ADDRESS, { input });
    this.activeOrder = await this.validateOrder(setOrderBillingAddress);
    return setOrderBillingAddress.billingAddress;
  }

  async setOrderShippingMethod(shippingMethodId: Id) {
    const { setOrderShippingMethod } = await this.rawRequest<
      any,
      MutationSetOrderShippingMethodArgs
    >(this.queries.SET_ORDER_SHIPPING_METHOD, { shippingMethodId });
    this.activeOrder = await this.validateOrder(setOrderShippingMethod);
    return setOrderShippingMethod.shippingLines[0]?.shippingMethod;
  }
}
