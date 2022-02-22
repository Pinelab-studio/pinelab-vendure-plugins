import { Order } from '@vendure/core';

export interface InvoiceData extends Object {
  invoiceNumber: number;
  customerEmail: string;
}

export interface DataStrategy {
  /**
   * Create a dataobject that is passed to your HTML template
   * Must include a unique invoiceNumber
   */
  getData(
    latestInvoiceNumber: number | undefined,
    order: Order
  ): Promise<InvoiceData>;
}
