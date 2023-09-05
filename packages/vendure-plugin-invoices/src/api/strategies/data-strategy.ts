import { RequestContext, Order, Injector } from '@vendure/core';
export interface InvoiceData {
  invoiceNumber: number;
  customerEmail: string;
  [key: string]: Object;
}

export interface DataFnInput {
  ctx: RequestContext;
  injector: Injector;
  latestInvoiceNumber: number | undefined;
  order: Order;
}

export interface DataStrategy {
  /**
   * Create a dataobject that is passed to your HTML template
   * Must include a unique invoiceNumber
   */
  getData(input: DataFnInput): Promise<InvoiceData>;
}
