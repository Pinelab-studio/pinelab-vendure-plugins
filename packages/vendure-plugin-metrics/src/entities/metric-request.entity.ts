import { Column, DeepPartial, Entity, Index } from 'typeorm';
import { ID, VendureEntity } from '@vendure/core';

/**
 * Entity storing anonymized requests
 */
@Entity()
export class MetricRequest extends VendureEntity {
  constructor(input?: DeepPartial<MetricRequest>) {
    super(input);
  }

  @Column()
  identifier!: string;

  @Column()
  deviceType!: string;

  @Index()
  @Column()
  channelToken!: string;
}
