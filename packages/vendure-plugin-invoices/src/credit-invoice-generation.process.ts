import { Logger, OrderProcess } from '@vendure/core';
import { InvoiceService } from './services/invoice.service';

let invoiceService: InvoiceService;

export const creditInvoiceGenerationProcess: OrderProcess<'Cancelled'> = {
  init(injector) {
    invoiceService = injector.get(InvoiceService);
  },

  async onTransitionStart(_, toState, data) {
    if (toState !== 'Cancelled') {
      return;
    }
    const previousInvoiceForOrder =
      await invoiceService.getMostRecentInvoiceForOrder(
        data.ctx,
        data.order.code
      );
    if (!previousInvoiceForOrder) {
      Logger.error(
        `Unable to create credit invoice for order ${data.order.id} as no previous invoices exist`
      );
      return;
    }
    const invoiceConfig = await invoiceService.getConfig(data.ctx);

    if (invoiceConfig) {
      await invoiceService.generateCreditInvoice(
        data.ctx,
        data.order,
        previousInvoiceForOrder,
        invoiceConfig,
        data.ctx.channel.token
      );
    }
  },
};
