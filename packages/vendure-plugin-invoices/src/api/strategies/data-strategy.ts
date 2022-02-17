import { Order } from '@vendure/core';
import { Invoice } from '../../ui/generated/graphql';

export interface InvoiceData extends Object {
  invoiceNumber: string;
  customerEmail: string;
}

export interface DataStrategy {
  /**
   * Create a dataobject that is passed to your HTML template
   * Must include a unique invoiceNumber
   */
  getData(
    previousInvoice: Invoice | undefined,
    order: Order
  ): Promise<InvoiceData>;
}

export class DefaultDataStrategy implements DataStrategy {
  async getData(previousInvoice: Invoice | undefined, order: Order) {
    if (!order.customer?.emailAddress) {
      throw Error(`Order doesnt have a customer.email set!`);
    }
    return {
      invoiceNumber: String(Math.floor(Math.random() * 90000) + 10000),
      customerEmail: order.customer.emailAddress,
      order,
    };
  }
}
