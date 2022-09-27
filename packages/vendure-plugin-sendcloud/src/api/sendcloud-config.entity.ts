import { DeepPartial, VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class SendcloudConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<SendcloudConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column()
  secret?: string;

  @Column()
  publicKey?: string;
}
