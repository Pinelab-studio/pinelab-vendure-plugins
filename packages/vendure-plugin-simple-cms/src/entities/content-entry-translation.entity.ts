import { VendureEntity, LanguageCode } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ContentEntry } from './content-entry.entity';

@Entity()
export class ContentEntryTranslation extends VendureEntity {
  constructor(input?: Partial<ContentEntryTranslation>) {
    super(input);
  }

  @Column('varchar')
  languageCode!: LanguageCode;

  @Column({ type: 'simple-json', nullable: true })
  fields!: Record<string, unknown>;

  @Index()
  @ManyToOne(() => ContentEntry, (base) => base.translatableFields, {
    onDelete: 'CASCADE',
  })
  base!: ContentEntry;
}
