import { Column, Entity, Unique } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity('invoice')
@Unique(['channelId', 'orderCode'])
@Unique(['channelId', 'orderId'])
@Unique(['channelId', 'invoiceNumber'])
export class InvoiceEntity extends VendureEntity {
  constructor(input?: DeepPartial<InvoiceEntity>) {
    super(input);
  }

  @Column()
  channelId!: string;
  @Column({ nullable: false })
  orderCode!: string;
  @Column({ nullable: false })
  orderId!: string;
  @Column({ nullable: false })
  customerEmail!: string;
  @Column({ nullable: false })
  invoiceNumber!: string;
  @Column({ nullable: false })
  storageReference!: string;
}
