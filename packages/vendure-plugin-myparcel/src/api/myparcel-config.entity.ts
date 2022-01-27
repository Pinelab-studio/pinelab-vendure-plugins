import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * Here we define a new database entity. Passing this in to the plugin's `entities` array
 * will instruct TypeORM to create the new database table and make the entity available
 * to query in your plugin code.
 */
@Entity()
export class MyparcelConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<MyparcelConfigEntity>) {
    super(input);
  }

  @Column({ unique: true })
  channelId!: string;

  @Column()
  apiKey!: string;
}
