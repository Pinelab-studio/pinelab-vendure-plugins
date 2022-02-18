import { Order } from '@vendure/core';
import { Invoice } from '../../ui/generated/graphql';
import { InvoiceEntity } from '../entities/invoice.entity';

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
    previousInvoice: InvoiceEntity | undefined,
    order: Order
  ): Promise<InvoiceData>;
}

export class DefaultDataStrategy implements DataStrategy {
  async getData(previousInvoice: InvoiceEntity | undefined, order: Order) {
    if (!order.customer?.emailAddress) {
      throw Error(`Order doesnt have a customer.email set!`);
    }
    let nr = Number(previousInvoice?.invoiceNumber);
    nr = nr ? nr + 1 : Math.floor(Math.random() * 90000) + 10000; // Increment or generate random
    return {
      orderDate: order.orderPlacedAt?.toISOString(),
      invoiceNumber: String(nr),
      customerEmail: order.customer.emailAddress,
      order,
    };
  }
}
