import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity()
export class Campaign extends VendureEntity {
  constructor(input: DeepPartial<Campaign>) {
    super(input);
  }

  @Column({ type: Date, nullable: true })
  deletedAt?: Date;

  @Column()
  channelId!: ID;

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'float' })
  conversionLast7Days?: number;

  @Column({ nullable: true, type: 'int' })
  revenueLast7days?: number;

  @Column({ nullable: true, type: 'int' })
  revenueLast30days?: number;

  @Column({ nullable: true, type: 'int' })
  revenueLast365Days?: number;
}
