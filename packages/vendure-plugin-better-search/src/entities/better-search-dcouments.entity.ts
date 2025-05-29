import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, ColumnType, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entity representing the serialized search documents used to instantiate an index instance.
 */
@Entity()
export class BetterSearchDocuments extends VendureEntity {
  constructor(input?: DeepPartial<BetterSearchDocuments>) {
    super(input);
  }

  // Override id to be text
  @PrimaryColumn({ type: 'text' })
  id!: string;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  @Column({
    type: (process.env.BETTER_SEARCH_INDEX_COLUMN_TYPE || 'text') as ColumnType,
  })
  data!: string;
}
