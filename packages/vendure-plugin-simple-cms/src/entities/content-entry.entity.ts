import { Channel, VendureEntity, ChannelAware } from '@vendure/core';
import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { ContentEntryTranslation } from './content-entry-translation.entity';

@Entity()
@Index(['updatedAt'])
export class ContentEntry extends VendureEntity implements ChannelAware {
  constructor(input?: Partial<ContentEntry>) {
    super(input);
  }

  @ManyToMany(() => Channel)
  @JoinTable()
  channels!: Channel[];

  @Column()
  @Index()
  contentTypeCode!: string;

  @Column({ type: 'simple-json', nullable: true })
  fields!: Record<string, unknown>;

  @OneToMany(() => ContentEntryTranslation, (translation) => translation.base, {
    eager: true,
  })
  translatableFields!: ContentEntryTranslation[];

  /** Soft-delete timestamp. Set by TypeORM on soft removal; null when active. */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
