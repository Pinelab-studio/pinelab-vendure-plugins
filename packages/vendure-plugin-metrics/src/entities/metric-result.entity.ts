import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';
import type { MetricChart } from '../types';

/**
 * The latest chart of a metric, per variation and channel.
 */
@Entity()
export class MetricResult extends VendureEntity {
  constructor(input?: DeepPartial<MetricResult>) {
    super(input);
  }

  @Index()
  @Column()
  code!: string;

  /**
   * Null when the strategy has no variations
   */
  @Column({ type: 'varchar', nullable: true })
  variation!: string | null;

  /**
   * Null for channel independent metrics
   */
  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  /**
   * Position of the variation in the dropdown
   */
  @Column()
  position!: number;

  @Column({ type: 'simple-json' })
  chart!: MetricChart;
}
