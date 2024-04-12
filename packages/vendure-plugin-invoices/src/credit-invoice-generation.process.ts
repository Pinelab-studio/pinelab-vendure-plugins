import { OrderProcess } from '@vendure/core';
import { InvoiceService } from './services/invoice.service';

let invoiceService: InvoiceService;

export const creditInvoiceGenerationProcess: OrderProcess<'Cancelled'> = {
  init(injector) {
    invoiceService = injector.get(InvoiceService);
  },

  async onTransitionStart(_, toState, data) {
    const previousInvoiceForOrder =
      await invoiceService.getMostRecentInvoiceForOrder(
        data.ctx,
        data.order.code
      );
    const invoiceConfig = await invoiceService.getConfig(data.ctx);

    if (toState === 'Cancelled' && previousInvoiceForOrder && invoiceConfig) {
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
