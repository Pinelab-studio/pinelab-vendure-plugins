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
    order: Order,
    isCreditInvoiceFor?: InvoiceEntity
  ): ExternalReference {
    return {
      reference: 'mockReference',
      link: 'mockLink',
    };
  }
}
