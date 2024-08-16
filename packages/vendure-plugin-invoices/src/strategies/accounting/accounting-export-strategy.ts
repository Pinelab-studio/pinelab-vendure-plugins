import { RequestContext, Order, Injector } from '@vendure/core';
import { InvoiceEntity } from '../../entities/invoice.entity';

export interface ExternalReference {
  /**
   * This can be an ID or string that references the created entry in your accounting system
   */
  reference: string;
  /**
   * You can optionally provide a link to the entry in your accounting system.
   * This will be displayed on an invoice in Vendure, so that admins can see the corresponding accounting invoice.
   */
  link?: string;
}

/**
 * Defines the interface for a strategy which is responsible for exporting accounting data to an external platform
 */
export interface AccountingExportStrategy {
  /**
   * Your strategy should expose a channel token, so that the plugin knows which export strategy to use for a given channel.
   * When no channel token is provided, the strategy will be used for all channels. In that case, make sure there is only 1 strategy configured!
   */
  channelToken?: string;

  init?(injector: Injector): Promise<void> | void;

  /**
   * Export the given Invoice to the external accounting system.
   * This function will be executed asynchronously in via the JobQueue
   */
  exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order,
    /**
     * If the invoice is a credit invoice, this will be the original invoice that the credit invoice is for.
     */
    isCreditInvoiceFor?: InvoiceEntity
  ): Promise<ExternalReference> | ExternalReference;
}
