import { GraphqlQueries } from './queries';
import { GraphQLClient, Variables } from 'graphql-request';
import { atom, WritableAtom } from 'nanostores';
import { ActiveOrderFieldsFragment, ActiveOrderQuery } from './graphql-types';
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
    this.eventBus.emit('item-added', { productVariantId, quantity });
    // TODO implement
    return undefined;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async rawRequest<T = void, I extends Variables | undefined = undefined>(
    document: string,
    variables?: I
  ): Promise<T> {
    const tokenName = 'vendure-auth-token';
    if (window?.localStorage) {
      // Make sure we send auth token in request
      const token = window.localStorage.getItem(tokenName);
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
      const token = headers.get(tokenName);
      if (token && window?.localStorage) {
        // Make sure we save received tokens
        window.localStorage.setItem(tokenName, token);
      }
      return data;
    } catch (e) {
      const error = (e as any).response?.errors?.[0];
      if (error) {
        console.error(e);
        // FIXME
      }
      throw e;
    }
  }
}
