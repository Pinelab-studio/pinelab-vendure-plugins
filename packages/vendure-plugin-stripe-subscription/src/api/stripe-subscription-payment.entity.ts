import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity, ID } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class StripeSubscriptionPayment extends VendureEntity {
  constructor(input?: DeepPartial<StripeSubscriptionPayment>) {
    super(input);
  }

  @Column({ nullable: true })
  invoiceId!: string;

  @Column({ nullable: true })
  collectionMethod!: string;

  @Column({ nullable: true })
  charge!: string;

  @Column({ nullable: true })
  currency!: string;

  @Column({ nullable: true })
  orderCode!: string;

  @Column({ nullable: true })
  channelId!: string;

  @Column({ nullable: true })
  subscriptionId!: string;
}
