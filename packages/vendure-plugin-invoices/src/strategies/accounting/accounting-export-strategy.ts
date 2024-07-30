import { RequestContext } from "@vendure/core";
import { InvoiceEntity } from "../../entities/invoice.entity";

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

    init?(): Promise<void>;

    /**
     * Export the given Invoice to the external accounting system.
     * This function will be executed asynchronously in via the JobQueue
     */
    exportInvoice(ctx: RequestContext, invoice: InvoiceEntity): Promise<ExternalReference>;
    
}