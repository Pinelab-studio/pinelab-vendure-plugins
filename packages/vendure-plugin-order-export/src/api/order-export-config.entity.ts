import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { OrderExportArgument } from '../ui/generated/graphql';
@Entity()
export class OrderExportConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<OrderExportConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column()
  name!: string;

  @Column('simple-json', { nullable: true })
  arguments?: OrderExportArgument[];
}
