import {
  Channel,
  Customer,
  CurrencyCode,
  DeepPartial,
  VendureEntity,
  ChannelAware,
  Money,
} from '@vendure/core';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { WalletAdjustment } from './wallet-adjustment.entity';

@Entity()
export class Wallet extends VendureEntity implements ChannelAware {
  constructor(input?: DeepPartial<Wallet>) {
    super(input);
  }

  @Money()
  amount!: number;

  @Money()
  initialAmount!: number;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  @ManyToMany((type) => Channel)
  @JoinTable()
  channels!: Channel[];

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @Index()
  customer!: Customer;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE', nullable: false })
  @Index()
  channel!: Channel;

  @Column({ type: 'enum', enum: CurrencyCode })
  currencyCode!: CurrencyCode;

  @Column({ type: 'bigint', default: 0 })
  balance!: string;

  @OneToMany(() => WalletAdjustment, (e) => e.wallet)
  ledgerEntries!: WalletAdjustment[];
}
