import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

@Entity('picqer_config')
export class PicqerConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<PicqerConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ nullable: true, length: 1500 })
  apiKey?: string;

  @Column({ nullable: true })
  apiEndpoint?: string;

  @Column({ nullable: true })
  storefrontUrl?: string;

  @Column({ nullable: true })
  supportEmail?: string;
}
