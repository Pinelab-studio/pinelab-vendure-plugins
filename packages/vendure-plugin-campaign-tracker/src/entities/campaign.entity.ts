import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Unique } from 'typeorm';

@Entity()
@Unique(['channelId', 'code'])
export class Campaign extends VendureEntity {
  constructor(input?: DeepPartial<Campaign>) {
    super(input);
  }

  @Column({ type: Date, nullable: true })
  deletedAt?: Date;

  @Column({ type: 'varchar' })
  channelId!: ID;

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: 0, type: 'int' })
  revenueLast7days: number = 0;

  @Column({ default: 0, type: 'int' })
  revenueLast30days: number = 0;

  @Column({ default: 0, type: 'int' })
  revenueLast365days: number = 0;

  @Column({ type: Date, nullable: true })
  metricsUpdatedAt?: Date;
}
