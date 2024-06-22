import { Column, Entity, OneToMany } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { ShipmateWebhookTokenEntity } from './shipmate-webhook-token.entitiy';

@Entity()
export class ShipmateConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<ShipmateConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column()
  apiKey!: string;

  @OneToMany(
    () => ShipmateWebhookTokenEntity,
    (shipmateConfig) => shipmateConfig.shipmateConfig
  )
  webhookAuthTokens!: ShipmateWebhookTokenEntity[];

  @Column()
  username!: string;

  @Column()
  password!: string;
}
