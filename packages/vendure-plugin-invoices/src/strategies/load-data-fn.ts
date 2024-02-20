import {
  Injector,
  Order,
  RequestContext,
  translateEntity,
} from '@vendure/core';
import { InvoiceEntity } from '../entities/invoice.entity';

export interface InvoiceData {
  invoiceNumber: number;
  [key: string]: any;
}

export interface CreditInvoiceInput {
  previousInvoice: InvoiceEntity;
  /**
   * The reversed (i.e. negative) order totals of the previous invoice
   */
  reversedOrderTotals: InvoiceEntity['orderTotals'];
}

export type LoadDataFn = (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  mostRecentInvoiceNumber?: number,
  /**
   * When shouldGenerateCreditInvoice is given, it means that the current invoice
   * needs to be a credit invoice for the given previous invoice
   */
  shouldGenerateCreditInvoice?: CreditInvoiceInput,
) => Promise<InvoiceData>;

interface DefaultInvoiceData {
  orderDate: string;
  invoiceNumber: number;
  order: Partial<Order>;
}

interface CreditInvoiceData extends DefaultInvoiceData {
  isCreditInvoice: true;
  originalInvoiceNumber: number;
}

export type DefaultInvoiceDataResponse = DefaultInvoiceData | CreditInvoiceData;

export const defaultLoadDataFn: LoadDataFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order,
  mostRecentInvoiceNumber?: number,
  shouldGenerateCreditInvoice?: CreditInvoiceInput,
): Promise<DefaultInvoiceDataResponse> => {
  // Increase order number
  let newInvoiceNumber = mostRecentInvoiceNumber || 0;
  newInvoiceNumber += 1;
  const orderDate = new Intl.DateTimeFormat('nl-NL').format(order.updatedAt);
  order.lines.forEach((line) => {
    line.productVariant = translateEntity(
      line.productVariant,
      ctx.languageCode,
    );
  });
  if (!shouldGenerateCreditInvoice) {
    // Normal debit invoice
    return {
      orderDate,
      invoiceNumber: newInvoiceNumber,
      order: order,
    };
  }
  // Create credit invoice
  const { previousInvoice, reversedOrderTotals } = shouldGenerateCreditInvoice;
  return {
    orderDate,
    invoiceNumber: newInvoiceNumber,
    isCreditInvoice: true,
    // Reference to original invoice because this is a credit invoice
    originalInvoiceNumber: previousInvoice.invoiceNumber,
    order: {
      ...order,
      total: reversedOrderTotals.total,
      totalWithTax: reversedOrderTotals.totalWithTax,
      taxSummary: reversedOrderTotals.taxSummaries,
    },
  };
};
