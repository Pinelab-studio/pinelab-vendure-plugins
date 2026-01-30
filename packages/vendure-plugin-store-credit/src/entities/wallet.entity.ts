import {
  Channel,
  Customer,
  DeepPartial,
  VendureEntity,
  ChannelAware,
  Money,
  Translatable,
  Translation,
  LocaleString,
} from '@vendure/core';
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { WalletAdjustment } from './wallet-adjustment.entity';
import { WalletTranslation } from './wallet-translation.entity';

@Entity()
export class Wallet
  extends VendureEntity
  implements ChannelAware, Translatable
{
  constructor(input?: DeepPartial<Wallet>) {
    super(input);
  }
  name!: LocaleString;

  @OneToMany(() => WalletTranslation, (translation) => translation.base, {
    eager: true,
  })
  translations!: Array<Translation<Wallet>>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  @ManyToMany((type) => Channel)
  @JoinTable()
  channels!: Channel[];

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @Index()
  customer!: Customer;

  @Money()
  balance!: number;

  @OneToMany(() => WalletAdjustment, (e) => e.wallet)
  adjustments!: WalletAdjustment[];
}
