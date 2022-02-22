import { Order } from '@vendure/core';
import { DataStrategy } from './data-strategy';

export class DefaultDataStrategy implements DataStrategy {
  async getData(latestInvoiceNumber: number | undefined, order: Order) {
    if (!order.customer?.emailAddress) {
      throw Error(`Order doesnt have a customer.email set!`);
    }
    let nr = latestInvoiceNumber;
    if (nr) {
      nr += 1;
    } else {
      nr = Math.floor(Math.random() * 90000) + 10000;
    }
    return {
      orderDate: order.orderPlacedAt
        ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
        : 'unknown',
      invoiceNumber: nr,
      customerEmail: order.customer.emailAddress,
      order,
    };
  }
}
