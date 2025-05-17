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
  @Column({ type: 'varchar' })
  channelId!: string | number;

  @Column({ type: 'varchar', nullable: true })
  path?: string;

  @Column({ type: 'varchar', nullable: true })
  productId?: string | number;

  @Column({ type: 'varchar', nullable: true })
  productVariantId?: string | number;
}
