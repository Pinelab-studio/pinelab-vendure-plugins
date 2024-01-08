import { RequestContext, Order, Injector, translateEntity } from '@vendure/core';
import { InvoiceEntity } from '../entities/invoice.entity';
import { reverseOrderTotals } from '../util/order-calculations';

export interface InvoiceData {
  invoiceNumber: number;
  [key: string]: any;
}

export type LoadDataFn = (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  mostRecentInvoiceNumber?: number,
  /**
   * When a previous invoice for this order is given, it means that the current invoice
   * needs to be a credit invoice for the given previous invoice
   */
  previousInvoiceForOrder?: InvoiceEntity
) => Promise<InvoiceData>;

export const defaultLoadDataFn: LoadDataFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  mostRecentInvoiceNumber?: number,
  previousInvoiceForOrder?: InvoiceEntity
): Promise<InvoiceData> => {
  // Increase order number
  let newInvoiceNumber = mostRecentInvoiceNumber || 0;
  newInvoiceNumber += 1;
  const orderDate = order.orderPlacedAt
  ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
  : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt);
  order.lines.forEach((line) => {
    line.productVariant = translateEntity(
      line.productVariant,
      ctx.languageCode
    );
  });
  if (previousInvoiceForOrder) {
    // This means we need to create a credit invoice for the given previous invoice
    return {
      orderDate,
      invoiceNumber: newInvoiceNumber,
      isCreditInvoice: true,
      order: order,
      reversedOrderTotals: reverseOrderTotals(previousInvoiceForOrder.orderTotals),
    }
  }
  return {
    orderDate,
    invoiceNumber: newInvoiceNumber,
    order: order,
  };
}
