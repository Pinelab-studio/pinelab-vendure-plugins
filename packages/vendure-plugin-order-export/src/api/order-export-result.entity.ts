import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { OrderExportArgument } from '../ui/generated/graphql';
@Entity('order_export_result')
export class OrderExportResultEntity extends VendureEntity {
  constructor(input?: DeepPartial<OrderExportResultEntity>) {
    super(input);
  }

  @Column({ unique: true })
  orderId!: string;

  @Column({ nullable: true })
  reference?: string;

  @Column({ type: 'text' })
  message?: string;

  @Column({ nullable: true })
  externalLink?: string;

  @Column()
  successful!: boolean;
}
