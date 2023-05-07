import { GraphqlQueries } from './queries';
import { GraphQLClient, Variables } from 'graphql-request';
import { atom, WritableAtom } from 'nanostores';
import {
  ActiveOrderFieldsFragment,
  ActiveOrderQuery,
  AdditemToOrderMutation,
  AdditemToOrderMutationVariables,
  AdjustOrderLineMutation,
  AdjustOrderLineMutationVariables,
  ErrorResult,
} from './graphql-types';
import mitt from 'mitt';
import { Id, VendureOrderEvents } from './events';

export type ActiveOrder<T> = ActiveOrderFieldsFragment & T;

/**
 * @example
 * const client = new VendureOrderClient(
 *      'http://localhost:3050/shop-api',
 *      'channel-token',
 * );
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
    this.queries = new GraphqlQueries(additionalOrderFields);
    this.activeOrderStore = atom<ActiveOrder<A> | undefined>(undefined);
  }

  async getActiveOrder(): Promise<ActiveOrder<A> | undefined> {
    const { activeOrder } = await this.rawRequest<ActiveOrderQuery>(
      this.queries.GET_ACTIVE_ORDER
    );
    this.activeOrder = activeOrder as ActiveOrder<A>;
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
    this.activeOrder = addItemToOrder as ActiveOrder<A>;
    this.eventBus.emit('item-added', { productVariantId, quantity });
    return this.activeOrder;
  }

  async adjustOrderLine(
    orderLineId: Id,
    quantity: number
  ): Promise<ActiveOrder<A> | undefined> {
    // TODO get current quantity from orderLine/activeOrder;
    const { adjustOrderLine } = await this.rawRequest<
      AdjustOrderLineMutation,
      AdjustOrderLineMutationVariables
    >(this.queries.ADJUST_ORDERLINE, {
      orderLineId,
      quantity,
    });
    this.activeOrder = adjustOrderLine as ActiveOrder<A>;
    // FIXME emit item-added or removed event
    // this.eventBus.emit('item-removed', { productVariantId, quantity });
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
   * Throws if result contains an error, if not, returns the non-error type
   */
  async validateResult<T>(result: T | ErrorResult): Promise<T> {
    if (result && (result as ErrorResult).errorCode) {
      const error = result as ErrorResult;
      if (
        error.errorCode === 'ORDER_MODIFICATION_ERROR' ||
        error.errorCode === 'ORDER_PAYMENT_STATE_ERROR'
      ) {
        window.localStorage.removeItem(this.tokenName); // These are unrecoverable states, so remove activeOrder
      }
      if (error.errorCode === 'INSUFFICIENT_STOCK_ERROR') {
        // Fetch activeOrder to view amount of items added after insufficient stock error
        await this.getActiveOrder();
      }
      throw error;
    }
    return result as T;
  }
}
