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

  @OneToMany(() => WalletAdjustment, (e) => e.wallet)
  adjustments!: WalletAdjustment[];
}
