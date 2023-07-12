import { VendureEntity, DeepPartial, CachedSession } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class MultiServerDbSessionCache extends VendureEntity {
  constructor(input?: DeepPartial<MultiServerDbSessionCache>) {
    super(input);
  }

  @Column('simple-json', { nullable: false })
  session!: CachedSession;

  @Index()
  @Column('varchar', { nullable: false })
  sessionToken!: string;
}
