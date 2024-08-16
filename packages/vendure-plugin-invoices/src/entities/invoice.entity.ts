import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Unique, Index } from 'typeorm';
import { InvoiceOrderTotals } from '../ui/generated/graphql';

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
