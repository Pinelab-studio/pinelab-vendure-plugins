import { GraphQLClient, Variables, gql } from 'graphql-request';
import mitt from 'mitt';
import { WritableAtom, atom } from 'nanostores';
import { MutationAddPaymentToOrderArgs } from './graphql-types';
import {
  ActiveOrderFieldsFragment,
  ActiveOrderQuery,
  AdditemToOrderMutation,
  AdditemToOrderMutationVariables,
  AdjustOrderLineMutation,
  AdjustOrderLineMutationVariables,
  CreateAddressInput,
  CreateCustomerInput,
  ErrorResult,
  MutationApplyCouponCodeArgs,
  MutationRemoveCouponCodeArgs,
  MutationSetCustomerForOrderArgs,
  MutationSetOrderBillingAddressArgs,
  MutationSetOrderShippingAddressArgs,
  MutationSetOrderShippingMethodArgs,
  MutationTransitionOrderToStateArgs,
  PaymentInput,
  QueryOrderByCodeArgs,
  RemoveAllOrderLinesMutation,
  RemoveAllOrderLinesMutationVariables,
} from './graphql-types.v2';
import { GraphqlQueries } from './queries';
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
export class VendureOrderClient<A = unknown> {
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
    const variantId =
      currentOrderLine?.productVariant.id ??
      adjustedOrderLine?.productVariant.id;
    if (adjustment > 0) {
      this.eventBus.emit('item-added', {
        productVariantIds: variantId ? [variantId] : [],
        quantity: adjustment,
      });
    } else {
      this.eventBus.emit('item-removed', {
        productVariantIds: variantId ? [variantId] : [],
        quantity: -adjustment, // adjustment is negative, so invert it
      });
    }
    return this.activeOrder;
  }

  async removeOrderLine(orderLineId: Id): Promise<ActiveOrder<A> | undefined> {
    return await this.adjustOrderLine(orderLineId, 0);
  }

  async removeAllOrderLines(): Promise<ActiveOrder<A> | undefined> {
    const totalQuantity = this.activeOrder?.totalQuantity ?? 0;
    const allVariantIds =
      this.activeOrder?.lines.map((line) => line.productVariant.id) ?? [];
    const { removeAllOrderLines } = await this.rawRequest<
      RemoveAllOrderLinesMutation,
      RemoveAllOrderLinesMutationVariables
    >(this.queries.REMOVE_ALL_ORDERLINES);
    this.activeOrder = await this.validateOrder(removeAllOrderLines);
    this.eventBus.emit('item-removed', {
      productVariantIds: allVariantIds,
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
        error.errorCode === 'ORDER_MODIFICATION_ERROR' ??
        error.errorCode === 'ORDER_PAYMENT_STATE_ERROR'
      ) {
        window.localStorage.removeItem(this.tokenName); // These are unrecoverable states, so remove activeOrder
      }
      if (
        error.errorCode === 'INSUFFICIENT_STOCK_ERROR' ??
        error.errorCode === 'COUPON_CODE_INVALID_ERROR'
      ) {
        // Fetch activeOrder to get the current right amount of items per orderLine
        await this.getActiveOrder();
      }
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw error;
    }
    // We've verified that result is not an error, so we can safely cast it
    return result as ActiveOrder<A>;
  }

  async applyCouponCode(
    couponCode: string
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    try {
      const { applyCouponCode } = await this.rawRequest<
        any,
        MutationApplyCouponCodeArgs
      >(this.queries.APPLY_COUPON_CODE, { couponCode });
      this.activeOrder = await this.validateOrder(applyCouponCode);
      this.eventBus.emit('coupon-code-applied', {
        couponCode,
      });
      return applyCouponCode;
    } catch (e: any) {
      return e;
    }
  }

  async removeCouponCode(
    couponCode: string
  ): Promise<ActiveOrderFieldsFragment> {
    const { removeCouponCode } = await this.rawRequest<
      any,
      MutationRemoveCouponCodeArgs
    >(this.queries.REMOVE_COUPON_CODE, { couponCode });
    this.activeOrder = await this.validateOrder(removeCouponCode);
    this.eventBus.emit('coupon-code-removed', {
      couponCode,
    });
    return removeCouponCode;
  }

  async setCustomerForOrder(
    input: CreateCustomerInput
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { setCustomerForOrder } = await this.rawRequest<
      any,
      MutationSetCustomerForOrderArgs
    >(this.queries.SET_CUSTOMER_FOR_ORDER, { input });
    this.activeOrder = await this.validateOrder(setCustomerForOrder);
    return setCustomerForOrder;
  }

  async setOrderShippingAddress(
    input: CreateAddressInput
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { setOrderShippingAddress } = await this.rawRequest<
      any,
      MutationSetOrderShippingAddressArgs
    >(this.queries.SET_ORDER_SHIPPING_ADDRESS, { input });
    this.activeOrder = await this.validateOrder(setOrderShippingAddress);
    return setOrderShippingAddress;
  }

  async addBillingAddress(
    input: CreateAddressInput
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { setOrderBillingAddress } = await this.rawRequest<
      any,
      MutationSetOrderBillingAddressArgs
    >(this.queries.SET_ORDER_BILLING_ADDRESS, { input });
    this.activeOrder = await this.validateOrder(setOrderBillingAddress);
    return setOrderBillingAddress;
  }

  async setOrderShippingMethod(
    shippingMethodId: Id[]
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { setOrderShippingMethod } = await this.rawRequest<
      any,
      MutationSetOrderShippingMethodArgs
    >(this.queries.SET_ORDER_SHIPPING_METHOD, { shippingMethodId });
    this.activeOrder = await this.validateOrder(setOrderShippingMethod);
    return setOrderShippingMethod;
  }

  async addPayment(
    input: PaymentInput
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { addPaymentToOrder } = await this.rawRequest<
      any,
      MutationAddPaymentToOrderArgs
    >(this.queries.ADD_PAYMENT_TO_ORDER, { input });
    this.activeOrder = await this.validateOrder(addPaymentToOrder);
    return addPaymentToOrder;
  }

  async transitionOrderToState(
    state: string
  ): Promise<ActiveOrderFieldsFragment | ErrorResult> {
    const { transitionOrderToState } = await this.rawRequest<
      any,
      MutationTransitionOrderToStateArgs
    >(this.queries.TRANSITION_ORDER_TO_STATE, { state });
    this.activeOrder = await this.validateOrder(transitionOrderToState);
    return transitionOrderToState;
  }

  async getOrderByCode(code: string): Promise<ActiveOrderFieldsFragment> {
    const { orderByCode } = await this.rawRequest<any, QueryOrderByCodeArgs>(
      this.queries.GET_ORDER_BY_CODE,
      { code }
    );
    return orderByCode;
  }
}
