import {
  DeepPartial,
  LocaleString,
  Translatable,
  Translation,
  VendureEntity,
} from '@vendure/core';
import { Column, Entity, OneToMany } from 'typeorm';

import { OrderCampaignTranslation } from './order-campaign-translation.entity';

@Entity()
export class OrderCampaign extends VendureEntity implements Translatable {
  constructor(input?: DeepPartial<OrderCampaign>) {
    super(input);
  }

  @Column()
  code: string;
  localizedName: LocaleString;

  @OneToMany(
    (type) => OrderCampaignTranslation,
    (translation) => translation.base,
    { eager: true }
  )
  translations: Array<Translation<OrderCampaign>>;
}
