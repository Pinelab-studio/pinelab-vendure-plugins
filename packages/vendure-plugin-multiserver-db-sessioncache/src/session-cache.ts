import { VendureEntity, DeepPartial, CachedSession } from '@vendure/core';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class MultiServerDbSessionCache extends VendureEntity {
  constructor(input?: DeepPartial<MultiServerDbSessionCache>) {
    super(input);
  }

  /**
   * We use the sessionToken as the primary key, as it is guaranteed to be unique
   * and we can update/override based on sessionToken
   */
  @PrimaryColumn('varchar', { nullable: false, unique: true })
  id!: string;

  @Column('simple-json', { nullable: false })
  session!: CachedSession;
}
