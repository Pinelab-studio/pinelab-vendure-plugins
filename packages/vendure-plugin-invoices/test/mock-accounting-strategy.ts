import { Injector, RequestContext, Order } from '@vendure/core';
import {
  AccountingExportStrategy,
  ExternalReference,
  InvoiceEntity,
} from '../src';

export class MockAccountingStrategy implements AccountingExportStrategy {
  constructor(public channelToken?: string) {}

  init(injector: Injector): void {
    return;
  }

  exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): ExternalReference {
    return {
      reference: 'mockReference',
      link: 'mockLink',
    };
  }

  exportCreditInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    isCreditInvoiceFor: InvoiceEntity,
    order: Order
  ): ExternalReference {
    return {
      reference: 'mockCreditReference',
      link: 'mockCreditLink',
    };
  }
}
