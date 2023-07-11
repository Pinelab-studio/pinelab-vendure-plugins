import { VendureEntity, DeepPartial, CachedSession } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class MultiServerDbSessionCache extends VendureEntity {
  constructor(input?: DeepPartial<MultiServerDbSessionCache>) {
    super(input);
  }

  @Column('varchar', { nullable: false })
  session!: string;

  @Index()
  @Column('varchar', { nullable: false })
  sessionToken!: string;
}
