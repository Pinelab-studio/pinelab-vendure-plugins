import { GraphqlQueries } from './queries';
import { GraphQLClient, Variables } from 'graphql-request';
import { atom, WritableAtom } from 'nanostores';
import { ActiveOrderFieldsFragment, ActiveOrderQuery } from './graphql-types';

export type Order<T> = ActiveOrderFieldsFragment & T;

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
  activeOrder: WritableAtom<Order<A> | undefined>;

  constructor(
    public url: string,
    public channelToken: string,
    public additionalOrderFields?: string
  ) {
    this.client = new GraphQLClient(url, {
      headers: { 'vendure-token': channelToken },
    });
    this.queries = new GraphqlQueries(additionalOrderFields);
    this.activeOrder = atom<Order<A> | undefined>(undefined);
  }

  async getActiveOrder(): Promise<Order<A> | undefined> {
    const { activeOrder } = await this.request<ActiveOrderQuery>(
      this.queries.GET_ACTIVE_ORDER
    );
    this.activeOrder.set(activeOrder as Order<A>);
    return this.activeOrder.get();
  }

  async request<T = void, I extends Variables | undefined = undefined>(
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
