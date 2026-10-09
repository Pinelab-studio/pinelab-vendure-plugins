import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, ColumnType, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entity representing a serialized search index keyed by channel and language.
 * The id field is overridden to act as the custom index key.
 */
@Entity()
export class BetterSearchIndex extends VendureEntity {
  constructor(input?: DeepPartial<BetterSearchIndex>) {
    super(input);
  }

  // Override id to be the custom index key
  @PrimaryColumn()
  id!: string;

  @Column({
    type: (process.env.BETTER_SEARCH_INDEX_COLUMN_TYPE || 'blob') as ColumnType,
  })
  data!: string;
}
