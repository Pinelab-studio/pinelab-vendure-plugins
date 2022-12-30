import { DeepPartial, VendureEntity } from '@vendure/core';
import {
  StripeSubscriptionSchedule,
  SubscriptionBillingInterval,
  SubscriptionDurationInterval,
  SubscriptionStartMoment,
} from './generated/graphql';
import { Column, Entity } from 'typeorm';

@Entity()
export class Schedule extends VendureEntity {
  constructor(input?: DeepPartial<Schedule>) {
    super(input);
  }

  @Column({ nullable: false })
  name!: string;

  @Column({ type: 'integer', nullable: true })
  downpayment!: number;

  @Column({ nullable: false })
  durationInterval!: SubscriptionDurationInterval;

  @Column({ type: 'integer', nullable: false })
  durationCount!: number;

  @Column({ nullable: false })
  startMoment!: SubscriptionStartMoment;

  @Column({ nullable: false })
  billingInterval!: SubscriptionBillingInterval;

  @Column({ type: 'integer', nullable: false })
  billingCount!: number;
}
