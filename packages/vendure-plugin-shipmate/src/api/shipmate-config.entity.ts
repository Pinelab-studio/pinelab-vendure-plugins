import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class ShipmateConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<ShipmateConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column()
  apiKey!: string;
}
