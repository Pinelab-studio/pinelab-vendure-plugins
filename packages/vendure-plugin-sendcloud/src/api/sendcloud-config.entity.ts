import { DeepPartial, VendureEntity } from '@vendure/core';
import { Entity, Column } from 'typeorm';

@Entity()
export class SendcloudConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<SendcloudConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column({ nullable: true })
  secret?: string;

  @Column({ nullable: true })
  publicKey?: string;

  @Column({ nullable: true })
  defaultPhoneNr?: string;
}
