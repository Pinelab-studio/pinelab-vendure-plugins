import { Column, Entity } from 'typeorm';
import { VendureEntity } from '@vendure/core';

@Entity()
export class ShipmateConfigEntity extends VendureEntity {
  @Column({ unique: true })
  channelId!: string;

  @Column()
  apiKey!: string;

  @Column('simple-array')
  webhookAuthTokens!: string[];

  @Column()
  username!: string;

  @Column()
  password!: string;
}
