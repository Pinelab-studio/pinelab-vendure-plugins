import { DeepPartial, ID, LanguageCode, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * A successful content generation by a strategy, for a channel and language.
 * Only created when `generateAndSaveContent()` returns a result, never when it
 * returns `false` or throws.
 */
@Entity()
// Used to look up the latest successful state of an entity.
// 191 chars per column keeps the index within MySQL's 3072-byte limit when using utf8mb4.
@Index(['strategyName', 'channelId', 'languageCode', 'entityId'], {
  unique: true,
})
export class ContentAutomationUpdate extends VendureEntity {
  constructor(input?: DeepPartial<ContentAutomationUpdate>) {
    super(input);
  }

  @Column('varchar', { length: 191 })
  strategyName!: string;

  @Column('varchar', { length: 191 })
  entityId!: ID;

  // Separate index for listing the updates of a channel in the dashboard
  @Index()
  @Column({ type: 'varchar', length: 191 })
  channelId!: ID;

  @Column('varchar', { length: 191 })
  languageCode!: LanguageCode;

  // The hash of the input the content was generated from. Longer hashes are
  // shortened by `normalizeHash()`, so they always fit this column.
  @Column('varchar', { length: 191 })
  hash!: string;

  @Column({ type: 'text', nullable: true })
  resultMessage?: string;

  // Text instead of varchar, so a long URL can't make storing the state fail
  @Column({ type: 'text', nullable: true })
  entityUrl?: string;
}
