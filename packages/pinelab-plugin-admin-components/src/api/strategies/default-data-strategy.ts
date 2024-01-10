import { translateEntity } from '@vendure/core';
import { DataFnInput, DataStrategy, InvoiceData } from './data-strategy';

export class DefaultDataStrategy implements DataStrategy {
  async getData({
    injector,
    order,
    latestInvoiceNumber,
    ctx,
  }: DataFnInput): Promise<InvoiceData> {
    order.lines.forEach((line) => {
      line.productVariant = translateEntity(
        line.productVariant,
        ctx.languageCode
      );
    });
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
        : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt),
      invoiceNumber: nr,
      customerEmail: order.customer.emailAddress,
      order,
    };
  }
}
