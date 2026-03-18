import { Channel, VendureEntity, ChannelAware } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
@Index(['createdAt'])
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
}
