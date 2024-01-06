import { RequestContext, Order, Injector, translateEntity } from '@vendure/core';

export interface InvoiceData {
  invoiceNumber: number | string;
  [key: string]: any;
}

export type DataLoadingFn = (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  previousInvoiceNumber: number | string | undefined,
) => Promise<InvoiceData>;

export const defaultDataLoadingFn: DataLoadingFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  previousInvoiceNumber: number | string | undefined,
): Promise<InvoiceData> {
  order.lines.forEach((line) => {
    line.productVariant = translateEntity(
      line.productVariant,
      ctx.languageCode
    );
  });
  if (!order.customer?.emailAddress) {
    throw Error(`Order doesnt have a customer.email set!`);
  }
  let nr = previousInvoiceNumber ? parseInt(previousInvoiceNumber as string) : 0;
  if (isNaN(nr)) {
    throw Error(`previousInvoiceNumber is not a number!`);
  }
  nr += 1;
  return {
    orderDate: order.orderPlacedAt
      ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
      : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt),
    invoiceNumber: nr,
    order: order,
  };
}
