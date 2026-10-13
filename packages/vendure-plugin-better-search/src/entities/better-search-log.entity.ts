import {
  DeepPartial,
  EntityId,
  ID,
  LanguageCode,
  VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/** A best-effort record of a successful storefront search, without shopper identifiers. */
@Entity()
@Index(['channelId', 'createdAt', 'id'])
export class BetterSearchLog extends VendureEntity {
  /** Creates a search log using Vendure's standard identity and timestamps. */
  constructor(input?: DeepPartial<BetterSearchLog>) {
    super(input);
  }

  /** Trimmed, lowercased term with consecutive whitespace collapsed. */
  @Column({ type: 'varchar', length: 255 })
  term!: string;

  /** Channel in which the search was executed. */
  @EntityId()
  channelId!: ID;

  /** Language used by the search index. */
  @Column({ type: 'varchar' })
  languageCode!: LanguageCode;

  /** Total matches before pagination, including zero-result searches. */
  @Column({ type: 'int' })
  resultCount!: number;
}
