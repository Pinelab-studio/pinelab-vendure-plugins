import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import { AdvancedMetricSummary } from '../ui/generated/graphql';

@Entity()
export class MetricSummary extends VendureEntity {
  constructor(input?: DeepPartial<MetricSummary>) {
    super(input);
  }

  @Column({ unique: true })
  key!: string;

  @Column({ type: 'varchar' })
  channelId!: ID;

  @Column({ type: 'simple-json' })
  summaryData!: AdvancedMetricSummary;
}
