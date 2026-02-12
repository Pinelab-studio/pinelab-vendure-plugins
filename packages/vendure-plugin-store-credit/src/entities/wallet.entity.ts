import {
  Channel,
  Customer,
  DeepPartial,
  VendureEntity,
  ChannelAware,
  Money,
} from '@vendure/core';
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  Column,
  Check,
  Unique,
  RelationId,
} from 'typeorm';
import { WalletAdjustment } from './wallet-adjustment.entity';

@Entity()
@Index(['createdAt'])
@Check(`"balance" >= 0`)
@Unique(['name', 'customer'])
export class Wallet extends VendureEntity implements ChannelAware {
  constructor(input?: DeepPartial<Wallet>) {
    super(input);
  }

  @ManyToMany(() => Channel)
  @JoinTable()
  channels!: Channel[];

  @Column()
  name!: string;

  @Column()
  currencyCode!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @Index()
  customer!: Customer;

  @RelationId((wallet: Wallet) => wallet.customer)
  customerId!: string;

  @Money()
  balance!: number;

  @OneToMany(() => WalletAdjustment, (e) => e.wallet)
  adjustments!: WalletAdjustment[];

  // FIXME just testing a change
}
