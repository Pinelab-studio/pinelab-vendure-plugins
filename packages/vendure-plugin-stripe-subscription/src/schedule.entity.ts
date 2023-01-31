import { DeepPartial, VendureEntity } from '@vendure/core';
import {
  SubscriptionInterval,
  SubscriptionStartMoment,
} from './ui/generated/graphql';
import { Column, Entity } from 'typeorm';

@Entity()
export class Schedule extends VendureEntity {
  constructor(input?: DeepPartial<Schedule>) {
    super(input);
  }

  @Column({ nullable: false })
  name!: string;

  @Column({ nullable: false })
  channelId!: string;

  @Column({ type: 'integer', nullable: false })
  downpaymentWithTax!: number;

  @Column({ nullable: false })
  durationInterval!: SubscriptionInterval;

  @Column({ type: 'integer', nullable: false })
  durationCount!: number;

  @Column({ nullable: false })
  startMoment!: SubscriptionStartMoment;

  @Column({ nullable: false })
  billingInterval!: SubscriptionInterval;

  @Column({ type: 'integer', nullable: false })
  billingCount!: number;

  /**
   * When billing and duration cycles are the same, this is a paid-up-front schedule
   * and the user pays the total amount of a subscription up front
   */
  get paidUpFront(): boolean {
    return (
      this.billingInterval.valueOf() == this.durationInterval.valueOf() &&
      this.billingCount.valueOf() == this.durationCount.valueOf()
    );
  }
}
