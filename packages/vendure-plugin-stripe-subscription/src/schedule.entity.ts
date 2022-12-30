import { DeepPartial, VendureEntity } from '@vendure/core';
import { SubscriptionBillingInterval } from './generated/graphql';
import { Entity, Column } from 'typeorm';

export enum DurationInterval {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export enum StartDate {
  START = 'Start of the billing interval',
  END = 'End of the billing interval',
}

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
  durationInterval!: DurationInterval;

  @Column({ type: 'integer', nullable: false })
  durationCount!: number;

  @Column({ nullable: false })
  startDate!: StartDate;

  @Column({ nullable: false })
  billingInterval!: SubscriptionBillingInterval;

  @Column({ type: 'integer', nullable: false })
  billingCount!: number;
}
