import { DeepPartial, User, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity()
export class WalletAdjustment extends VendureEntity {
  constructor(input?: DeepPartial<WalletAdjustment>) {
    super(input);
  }

  @ManyToOne(() => Wallet, (w) => w.adjustments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  wallet!: Wallet;

  @Column()
  amount!: number;

  @Column()
  description!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  mutatedBy!: User;
}
