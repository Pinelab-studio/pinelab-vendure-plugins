import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity('e_boekhouden_config')
export class EBoekhoudenConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<EBoekhoudenConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelToken!: string;

  @Column({ nullable: false })
  enabled!: boolean;

  @Column({ nullable: false })
  username!: string;

  @Column({ nullable: false })
  secret1!: string;

  @Column({ nullable: false })
  secret2!: string;

  @Column({ nullable: false })
  account!: string;

  @Column({ nullable: false })
  contraAccount!: string;
}
