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
  Column,
} from 'typeorm';
import { WalletAdjustment } from './wallet-adjustment.entity';

@Entity()
export class Wallet extends VendureEntity implements ChannelAware {
  constructor(input?: DeepPartial<Wallet>) {
    super(input);
  }

  @ManyToMany(() => Channel)
  @JoinTable()
  channels!: Channel[];

  @Column()
  name!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @Index()
  customer!: Customer;

  @Money()
  balance!: number;

  @OneToMany(() => WalletAdjustment, (e) => e.wallet)
  adjustments!: WalletAdjustment[];
}
