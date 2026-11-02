import {
  Channel,
  ChannelAware,
  Customer,
  DeepPartial,
  Money,
  VendureEntity,
} from '@vendure/core';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  RelationId,
} from 'typeorm';
import { WalletAdjustment } from './wallet-adjustment.entity';

@Entity()
@Index(['createdAt'])
@Check(`"balance" >= 0`)
export class Wallet extends VendureEntity implements ChannelAware {
  constructor(input?: DeepPartial<Wallet>) {
    super(input);
  }

  @ManyToMany(() => Channel)
  @JoinTable()
  channels!: Channel[];

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    nullable: true,
  })
  code?: string;

  @Column()
  currencyCode!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
  @Index()
  customer?: Customer;

  @RelationId((wallet: Wallet) => wallet.customer)
  customerId?: string;

  @Money()
  balance!: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(
    () => WalletAdjustment,
    (e) => e.wallet,
  )
  adjustments!: WalletAdjustment[];
}
