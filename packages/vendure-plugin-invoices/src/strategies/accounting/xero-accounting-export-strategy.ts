import { RequestContext } from "@vendure/core";
import { AccountingExportStrategy, ExternalReference } from "./accounting-export-strategy";
import { InvoiceEntity } from "../../entities/invoice.entity";
import { Contact, Invoice, LineItem, LineItemTracking } from "xero-node";

interface Config {
    clientId: string;
    clientSecret: string;
    /**
     * Get this from your Xero's dashboard URL. 
     * E.g. the tenant id of https://go.xero.com/app/!SY985/dashboard is !SY985
     */
    tenantId: string;
}

export class XeroAccountingExportStrategy implements AccountingExportStrategy {

    private xero!: import('xero-node').XeroClient;

    constructor(private config: Config) {
    }

    async init(): Promise<void> {
        try {
            const XeroNode = await import('xero-node');
            this.xero = new XeroNode.XeroClient({
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret,
                scopes: ['accounting.transactions']
            });
        } catch (e: any) {
            throw Error(`Could not find the "xero-node" package. Make sure it is installed: ${e?.message}`);
        }
    }

    async exportInvoice(ctx: RequestContext, _invoice: InvoiceEntity): Promise<ExternalReference> {

        // TODO Create Contact

        const lineItem: LineItem = {
            description: "Foobar",
            quantity: 1.0,
            unitAmount: 20.0,
            accountCode: "000",
        };
        const lineItems = [lineItem];

        const invoice: import('xero-node').Invoice = {
            type: Invoice.TypeEnum.ACCREC,
            contact: {
                    contactID: "00000000-0000-0000-0000-000000000000"
            },
            date: this.toDate(new Date()), // FIXME,
            lineItems: lineItems,
            reference: "Website Design",
            status: Invoice.StatusEnum.DRAFT
        };

        const invoices: Invoices = {
            invoices: [invoice]
        };

        try {
            const response = await xero.accountingApi.createInvoices(xeroTenantId, invoices, summarizeErrors, unitdp, idempotencyKey);
            console.log(response.body || response.response.statusCode)
        } catch (err) {
            const error = JSON.stringify(err.response.body, null, 2)
            console.log(`Status Code: ${err.response.statusCode} => ${error}`);
        }
    }

    private toDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }
}