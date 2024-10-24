import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';
import { Campaign } from './campaign.entity';

/**
 * @description
 * This entity represents the relation between an Order and a Campaign, including the connectedAt date
 */
@Entity()
export class OrderCampaign extends VendureEntity {
  constructor(input?: DeepPartial<OrderCampaign>) {
    super(input);
  }

  /**
   * The date time at which the campaign was connected to the order
   */
  get connectedAt(): Date {
    return this.updatedAt;
  }

  @Column({ type: 'varchar' })
  orderId!: ID;

  @ManyToOne(() => Campaign, { eager: true })
  campaign!: Campaign;
}
