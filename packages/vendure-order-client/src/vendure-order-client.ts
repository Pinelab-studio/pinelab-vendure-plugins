import { gql, GraphQLClient, Variables } from 'graphql-request';
import mitt, { Emitter } from 'mitt';
import { map } from 'nanostores';
import {
  ActiveOrderFieldsFragment,
  ActiveOrderQuery,
  AdditemToOrderMutation,
  AdditemToOrderMutationVariables,
  AddPaymentToOrderMutation,
  AdjustOrderLineMutation,
  AdjustOrderLineMutationVariables,
  ApplyCouponCodeMutation,
  CreateAddressInput,
  CreateCustomerInput,
  CurrentUserFieldsFragment,
  ErrorResult,
  LoginMutation,
  MutationAddPaymentToOrderArgs,
  MutationApplyCouponCodeArgs,
  MutationLoginArgs,
  MutationRegisterCustomerAccountArgs,
  MutationRemoveCouponCodeArgs,
  MutationRequestPasswordResetArgs,
  MutationResetPasswordArgs,
  MutationSetCustomerForOrderArgs,
  MutationSetOrderBillingAddressArgs,
  MutationSetOrderShippingAddressArgs,
  MutationSetOrderShippingMethodArgs,
  MutationTransitionOrderToStateArgs,
  PaymentInput,
  QueryOrderByCodeArgs,
  RegisterCustomerAccountMutation,
  RegisterCustomerInput,
  RemoveAllOrderLinesMutation,
  RemoveAllOrderLinesMutationVariables,
  RemoveCouponCodeMutation,
  RequestPasswordResetMutation,
  ResetPasswordMutation,
  SetCustomerForOrderMutation,
  SetOrderBillingAddressMutation,
  SetOrderShippingAddressMutation,
  SetOrderShippingMethodMutation,
  Success,
  TransitionOrderToStateMutation,
} from './graphql-generated-types';
import { GraphqlQueries } from './queries';
import { setResult, HandleLoadingState, StateStore } from './store-helpers';
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
export type CurrentUser = CurrentUserFieldsFragment;

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
  eventBus: Emitter<VendureOrderEvents> = mitt<VendureOrderEvents>();

  /**
   * The store object that holds the active order.
   */
  $activeOrder = map<StateStore<ActiveOrder<A> | undefined>>({
    loading: false,
    error: undefined,
    data: undefined,
  });

  /**
   * The store object that holds the current logged in user
   */
  $currentUser = map<StateStore<CurrentUser | undefined>>({
    loading: false,
    error: undefined,
    data: undefined,
  });

  // TODO: create similar stores for eligibleShippingMethods, eligiblePaymentMethods

  readonly tokenName = 'vendure-auth-token';

  constructor(
    public url: string,
    public channelToken: string,
    public additionalOrderFields?: string
  ) {
    this.client = new GraphQLClient(url, {
      headers: { 'vendure-token': channelToken },
    });
    this.queries = new GraphqlQueries(additionalOrderFields ?? dummyFragment);
  }

  @HandleLoadingState('$activeOrder')
  async getActiveOrder(): Promise<ActiveOrder<A> | undefined> {
    const { activeOrder } = await this.rawRequest<ActiveOrderQuery>(
      this.queries.GET_ACTIVE_ORDER
    );
    setResult(this.$activeOrder, activeOrder);
    if (!activeOrder) {
      return;
    }
    return this.throwIfErrorResult(activeOrder as ActiveOrder<A>);
  }

  @HandleLoadingState('$activeOrder')
  async addItemToOrder(
    productVariantId: Id,
    quantity: number
  ): Promise<ActiveOrder<A>> {
    const { addItemToOrder } = await this.rawRequest<
      AdditemToOrderMutation,
      AdditemToOrderMutationVariables
    >(this.queries.ADD_ITEM_TO_ORDER, {
      productVariantId,
      quantity,
    });
    const activeOrder = this.throwIfErrorResult(
      addItemToOrder as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    this.eventBus.emit('item-added', {
      productVariantIds: [productVariantId],
      quantity,
    });
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async adjustOrderLine(
    orderLineId: Id,
    quantity: number
  ): Promise<ActiveOrder<A>> {
    const currentOrderLine = this.$activeOrder
      .get()
      .data?.lines.find((line) => line.id === orderLineId);
    const currentQuantity = currentOrderLine?.quantity ?? 0;
    const { adjustOrderLine } = await this.rawRequest<
      AdjustOrderLineMutation,
      AdjustOrderLineMutationVariables
    >(this.queries.ADJUST_ORDERLINE, {
      orderLineId,
      quantity,
    });
    const activeOrder = this.throwIfErrorResult(
      adjustOrderLine as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    const adjustedOrderLine = this.$activeOrder
      .get()
      .data?.lines.find((line) => line.id === orderLineId);
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
    return activeOrder;
  }

  async removeOrderLine(orderLineId: Id): Promise<ActiveOrder<A>> {
    return await this.adjustOrderLine(orderLineId, 0);
  }

  @HandleLoadingState('$activeOrder')
  async removeAllOrderLines(): Promise<ActiveOrder<A>> {
    const totalQuantity = this.$activeOrder.get().data?.totalQuantity ?? 0;
    const allVariantIds =
      this.$activeOrder
        .get()
        .data?.lines.map((line) => line.productVariant.id) ?? [];
    const { removeAllOrderLines } = await this.rawRequest<
      RemoveAllOrderLinesMutation,
      RemoveAllOrderLinesMutationVariables
    >(this.queries.REMOVE_ALL_ORDERLINES);
    const activeOrder = this.throwIfErrorResult(
      removeAllOrderLines as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    this.eventBus.emit('item-removed', {
      productVariantIds: allVariantIds,
      quantity: totalQuantity,
    });
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async applyCouponCode(couponCode: string): Promise<ActiveOrder<A>> {
    const { applyCouponCode } = await this.rawRequest<
      ApplyCouponCodeMutation,
      MutationApplyCouponCodeArgs
    >(this.queries.APPLY_COUPON_CODE, { couponCode });
    const activeOrder = this.throwIfErrorResult(
      applyCouponCode as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    this.eventBus.emit('coupon-code-applied', {
      couponCode,
    });
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async removeCouponCode(
    couponCode: string
  ): Promise<ActiveOrder<A> | undefined> {
    const { removeCouponCode } = await this.rawRequest<
      RemoveCouponCodeMutation,
      MutationRemoveCouponCodeArgs
    >(this.queries.REMOVE_COUPON_CODE, { couponCode });
    if (!removeCouponCode) {
      return;
    }
    const activeOrder = this.throwIfErrorResult(
      removeCouponCode as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    this.eventBus.emit('coupon-code-removed', {
      couponCode,
    });
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async setCustomerForOrder(
    input: CreateCustomerInput
  ): Promise<ActiveOrder<A>> {
    const { setCustomerForOrder } = await this.rawRequest<
      SetCustomerForOrderMutation,
      MutationSetCustomerForOrderArgs
    >(this.queries.SET_CUSTOMER_FOR_ORDER, { input });
    const activeOrder = this.throwIfErrorResult(
      setCustomerForOrder as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async setOrderShippingAddress(
    input: CreateAddressInput
  ): Promise<ActiveOrder<A>> {
    const { setOrderShippingAddress } = await this.rawRequest<
      SetOrderShippingAddressMutation,
      MutationSetOrderShippingAddressArgs
    >(this.queries.SET_ORDER_SHIPPING_ADDRESS, { input });
    const activeOrder = this.throwIfErrorResult(
      setOrderShippingAddress as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async addBillingAddress(input: CreateAddressInput): Promise<ActiveOrder<A>> {
    const { setOrderBillingAddress } = await this.rawRequest<
      SetOrderBillingAddressMutation,
      MutationSetOrderBillingAddressArgs
    >(this.queries.SET_ORDER_BILLING_ADDRESS, { input });
    const activeOrder = this.throwIfErrorResult(
      setOrderBillingAddress as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async setOrderShippingMethod(
    shippingMethodId: Id[]
  ): Promise<ActiveOrder<A>> {
    const { setOrderShippingMethod } = await this.rawRequest<
      SetOrderShippingMethodMutation,
      MutationSetOrderShippingMethodArgs
    >(this.queries.SET_ORDER_SHIPPING_METHOD, { shippingMethodId });
    const activeOrder = this.throwIfErrorResult(
      setOrderShippingMethod as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async addPayment(input: PaymentInput): Promise<ActiveOrder<A>> {
    const { addPaymentToOrder } = await this.rawRequest<
      AddPaymentToOrderMutation,
      MutationAddPaymentToOrderArgs
    >(this.queries.ADD_PAYMENT_TO_ORDER, { input });
    const activeOrder = this.throwIfErrorResult(
      addPaymentToOrder as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  @HandleLoadingState('$activeOrder')
  async transitionOrderToState(
    state: string
  ): Promise<ActiveOrder<A> | undefined> {
    const { transitionOrderToState } = await this.rawRequest<
      TransitionOrderToStateMutation,
      MutationTransitionOrderToStateArgs
    >(this.queries.TRANSITION_ORDER_TO_STATE, { state });
    if (!transitionOrderToState) {
      return;
    }
    const activeOrder = this.throwIfErrorResult(
      transitionOrderToState as ActiveOrder<A>
    );
    setResult(this.$activeOrder, activeOrder);
    return activeOrder;
  }

  /**
   * Get order by code. This will not update the internal activeOrder store
   */
  @HandleLoadingState('$activeOrder')
  async getOrderByCode(code: string): Promise<ActiveOrder<A>> {
    const { orderByCode } = await this.rawRequest<any, QueryOrderByCodeArgs>(
      this.queries.GET_ORDER_BY_CODE,
      { code }
    );
    return orderByCode;
  }

  async registerCustomerAccount(
    input: RegisterCustomerInput
  ): Promise<Success | ErrorResult> {
    const { registerCustomerAccount } = await this.rawRequest<
      RegisterCustomerAccountMutation,
      MutationRegisterCustomerAccountArgs
    >(this.queries.REGISTER_CUSTOMER_ACCOUNT, { input });
    return registerCustomerAccount;
  }

  async requestPasswordReset(
    emailAddress: string
  ): Promise<Success | ErrorResult | undefined> {
    const { requestPasswordReset } = await this.rawRequest<
      RequestPasswordResetMutation,
      MutationRequestPasswordResetArgs
    >(this.queries.REQUEST_PASSWORD_RESET, { emailAddress });
    return requestPasswordReset;
  }

  @HandleLoadingState('$currentUser')
  async resetPassword(password: string, token: string): Promise<CurrentUser> {
    const { resetPassword } = await this.rawRequest<
      ResetPasswordMutation,
      MutationResetPasswordArgs
    >(this.queries.RESET_PASSWORD, { token, password });
    const currentUser = this.throwIfErrorResult(resetPassword as CurrentUser);
    setResult(this.$currentUser, currentUser);
    return currentUser;
  }

  @HandleLoadingState('$currentUser')
  async login(
    username: string,
    password: string,
    rememberMe?: boolean
  ): Promise<CurrentUser> {
    const { login } = await this.rawRequest<LoginMutation, MutationLoginArgs>(
      this.queries.LOGIN,
      { username, password, rememberMe }
    );
    const currentUser = this.throwIfErrorResult(login as CurrentUser);
    setResult(this.$currentUser, currentUser);
    return currentUser;
  }

  /**
   * Throw if result is an ErrorResult
   */
  throwIfErrorResult<T>(result: T | ErrorResult): T {
    if (result && (result as ErrorResult).errorCode) {
      const error = result as ErrorResult;
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw error;
    }
    // We've verified that result is not an error, so we can safely cast it
    return result as T;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  protected async rawRequest<T = void, I = undefined>(
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
        variables as Variables // Needed because of TS bug https://github.com/microsoft/TypeScript/issues/42825
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
}
