'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceCreatedEvent = void 0;
const core_1 = require('@vendure/core');
/**
 * This event is emitted when invoices are created.
 * In case of a re-generation of an invoice for an order, one single event will be emitted
 * with the previous invoice, credit invoice, and the new invoice.
 */
class InvoiceCreatedEvent extends core_1.VendureEvent {
  constructor(input) {
    super();
    this.ctx = input.ctx;
    this.order = input.order;
    this.newInvoice = input.newInvoice;
    this.previousInvoice = input.previousInvoice;
    this.creditInvoice = input.creditInvoice;
  }
}
exports.InvoiceCreatedEvent = InvoiceCreatedEvent;
