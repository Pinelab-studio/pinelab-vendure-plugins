import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity('invoice_config')
export class InvoiceConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<InvoiceConfigEntity>) {
    super(input);
  }

  @Column()
  channelId!: string;
  @Column({ default: false })
  enabled: boolean = false;
  @Column({ type: 'longtext', nullable: true })
  templateString?: string | null;
}
