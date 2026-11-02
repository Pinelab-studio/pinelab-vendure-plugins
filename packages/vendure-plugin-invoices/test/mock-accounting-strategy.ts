import { Injector, Order, RequestContext } from '@vendure/core';
import {
  AccountingExportStrategy,
  ExternalReference,
  InvoiceEntity,
} from '../src';

export class MockAccountingStrategy implements AccountingExportStrategy {
  constructor(public channelToken?: string) {}

  init(_injector: Injector): void {
    return;
  }

  exportInvoice(
    _ctx: RequestContext,
    _invoice: InvoiceEntity,
    _order: Order,
  ): ExternalReference {
    return {
      reference: 'mockReference',
      link: 'mockLink',
    };
  }

  exportCreditInvoice(
    _ctx: RequestContext,
    _invoice: InvoiceEntity,
    _isCreditInvoiceFor: InvoiceEntity,
    _order: Order,
  ): ExternalReference {
    return {
      reference: 'mockCreditReference',
      link: 'mockCreditLink',
    };
  }
}
