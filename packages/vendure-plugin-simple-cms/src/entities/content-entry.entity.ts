import { Channel, VendureEntity, ChannelAware } from '@vendure/core';
import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { ContentEntryTranslation } from './content-entry-translation.entity';

@Entity()
@Index(['updatedAt'])
@Index(['code'])
export class ContentEntry extends VendureEntity implements ChannelAware {
  constructor(input?: Partial<ContentEntry>) {
    super(input);
  }

  @ManyToMany(() => Channel)
  @JoinTable()
  channels!: Channel[];

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column()
  @Index()
  contentTypeCode!: string;

  @Column({ type: 'simple-json', nullable: true })
  fields!: Record<string, unknown>;

  @OneToMany(() => ContentEntryTranslation, (translation) => translation.base, {
    eager: true,
  })
  translatableFields!: ContentEntryTranslation[];
}
