import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * Simple entity to keep track of what QLS orders were created for what Vendure orders.
 */
@Entity()
export class QlsOrderEntity extends VendureEntity {
  constructor(input?: DeepPartial<QlsOrderEntity>) {
    super(input);
  }

  @Column({ type: 'text', nullable: false, unique: true })
  qlsOrderId!: ID;

  @Column({ type: 'text', nullable: false })
  vendureOrderId!: ID;
}
