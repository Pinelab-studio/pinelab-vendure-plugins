import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Translation, VendureEntity, LanguageCode } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity()
export class WalletTranslation
  extends VendureEntity
  implements Translation<Wallet>
{
  constructor(input?: DeepPartial<Translation<WalletTranslation>>) {
    super(input);
  }

  @Column('varchar')
  languageCode!: LanguageCode;

  @Column()
  name!: string;

  @Index()
  @ManyToOne(() => Wallet, (base) => base.translations, { onDelete: 'CASCADE' })
  base!: Wallet;
}
