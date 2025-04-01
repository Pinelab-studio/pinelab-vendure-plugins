import {
  Column,
  DeepPartial,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
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
  deviceType!: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';

  @Index()
  @Column()
  channelToken!: string;
}
