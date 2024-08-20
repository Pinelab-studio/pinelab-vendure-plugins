import { Order, RequestContext, VendureEvent } from '@vendure/core';
import { InvoiceEntity } from '../entities/invoice.entity';

/**
 * This event is emitted when invoices are created.
 * In case of a re-generation of an invoice for an order, one single event will be emitted
 * with the previous invoice, credit invoice, and the new invoice.
 */
export class InvoiceCreatedEvent extends VendureEvent {
  public ctx: RequestContext;
  public order: Order;
  /**
   * The new invoice that was created.
   * This can be a credit invoice, if only a credit invoice was generated and no new debit invoice.
   * This happens for example when an order is cancelled
   */
  public newInvoice: InvoiceEntity;
  /**
   * The previous invoice for this order.
   * Undefined when this is the first invoice for the order.
   */
  public previousInvoice?: InvoiceEntity;
  /**
   * The credit invoice for `originalInvoice`.
   * Undefined when credit invoices are disabled,
   * or when this is the first invoice for the order
   */
  public creditInvoice?: InvoiceEntity;

  constructor(input: {
    ctx: RequestContext;
    order: Order;
    newInvoice: InvoiceEntity;
    previousInvoice?: InvoiceEntity;
    creditInvoice?: InvoiceEntity;
  }) {
    super();
    this.ctx = input.ctx;
    this.order = input.order;
    this.newInvoice = input.newInvoice;
    this.previousInvoice = input.previousInvoice;
    this.creditInvoice = input.creditInvoice;
  }
}
