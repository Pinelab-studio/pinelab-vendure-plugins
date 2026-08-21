import { DeepPartial, ID, LanguageCode, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';
import { ContentCheckMessage } from '../types';

// Fully replaced on every re-check (no history kept), so one row per
// (entityType, entityId, channelId, languageCode) is enforced below.
@Entity()
@Unique(['entityType', 'entityId', 'channelId', 'languageCode'])
export class ContentCheckResult extends VendureEntity {
  constructor(input?: DeepPartial<ContentCheckResult>) {
    super(input);
  }

  // 'product' | 'collection' for the built-in scan pipeline, or a free-form
  // string chosen by an `additionalChecks` function for custom entities.
  @Column('varchar')
  entityType!: string;

  @Index()
  @Column({ type: 'varchar' })
  entityId!: ID;

  @Index()
  @Column({ type: 'varchar' })
  channelId!: ID;

  @Column('varchar')
  languageCode!: LanguageCode;

  @Column({ nullable: true })
  url?: string;

  // Only set for `additionalChecks` results (custom entityType): the
  // plugin has no generic way to look up a display name for an arbitrary
  // entity, so it's captured at check time. Product/collection names are
  // always resolved live instead, so this stays null for those rows.
  @Column({ nullable: true })
  label?: string;

  // Denormalized from `messages`, so the overview/alert queries can filter
  // on a plain column instead of scanning the JSON blob.
  @Column({ default: false })
  hasError!: boolean;

  @Column({ default: false })
  hasWarning!: boolean;

  @Column('simple-json')
  messages!: ContentCheckMessage[];

  @Column()
  checkedAt!: Date;
}
