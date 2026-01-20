import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * Each `Webhook` entity represents 1 webhook call for the specified
 * Event with the specified Url and Transformer
 */
@Entity()
export class Webhook extends VendureEntity {
  constructor(input?: DeepPartial<Webhook>) {
    super(input);
  }

  @Column()
  channelId!: string;

  @Column()
  url!: string;

  @Column()
  event!: string;

  @Column({ nullable: true })
  transformerName?: string;

  /**
   * When set to true, this webhook is available for all channels.
   * Otherwise, it is only available for the channel specified in the `channelId` column.
   */
  @Column({ default: false })
  channelAgnostic: boolean = false;
}
