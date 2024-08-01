import { OrderTaxSummary } from '@vendure/common/lib/generated-types';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Unique, Index } from 'typeorm';

/**
 * The order totals that were used to generate the invoice.
 * These can be used to generate credit invoices.
 */
interface InvoiceOrderTotals {
  taxSummaries: OrderTaxSummary[];
  total: number;
  totalWithTax: number;
}

@Entity('invoice')
@Unique(['channelId', 'invoiceNumber'])
export class InvoiceEntity extends VendureEntity {
  constructor(input?: DeepPartial<InvoiceEntity>) {
    super(input);
  }

  @Index()
  @Column()
  channelId!: string; // Channel id is needed here to ensure uniqueness of invoiceNumber

  @Index()
  @Column({ nullable: false })
  orderId!: string;

  @Column({ nullable: false, type: 'int' })
  invoiceNumber!: number;

  @Column({ nullable: false })
  storageReference!: string;

  get isCreditInvoice(): boolean {
    return this.orderTotals.total < 0;
  }

  /**
   * The order totals that were used to generate the invoice.
   * These are needed when generating credit invoices for a previous invoice.
   */
  @Column({ nullable: true, type: 'simple-json' })
  orderTotals!: InvoiceOrderTotals;
}
