import {
  Column,
  DeepPartial,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ID, VendureEntity } from '@vendure/core';

/**
 * Salt that rotates every 24 hours
 */
@Entity()
export class MetricRequestSalt extends VendureEntity {
  constructor(input?: DeepPartial<MetricRequestSalt>) {
    super(input);
  }
  @Column()
  salt!: string;
}
