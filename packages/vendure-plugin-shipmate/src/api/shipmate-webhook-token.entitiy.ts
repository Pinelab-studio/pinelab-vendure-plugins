import { Column, ManyToOne, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { ShipmateConfigEntity } from './shipmate-config.entity';

@Entity()
export class ShipmateWebhookTokenEntity extends VendureEntity {
  constructor(input?: DeepPartial<ShipmateWebhookTokenEntity>) {
    super(input);
  }

  @Column({ unique: true })
  @Index()
  token!: string;

  @ManyToOne(
    () => ShipmateConfigEntity,
    (shipmateConfig) => shipmateConfig.webhookAuthTokens
  )
  shipmateConfig!: ShipmateConfigEntity;
}
