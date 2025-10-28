import {
  DeepPartial,
  EntityId,
  HasCustomFields,
  ID,
  Order,
  VendureEntity,
} from '@vendure/core';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

export class UtmOrderParameterCustomFields {}

@Entity()
export class UtmOrderParameter
  extends VendureEntity
  implements HasCustomFields
{
  constructor(input?: DeepPartial<UtmOrderParameter>) {
    super(input);
  }

  /**
   * The date and time when the UTM parameter was connected to the order.
   * This is updated when the same parameters are added to the order again.
   */
  @Column()
  connectedAt!: Date;

  @Column({ nullable: true })
  utmSource?: string;

  @Column({ nullable: true })
  utmMedium?: string;

  @Column({ nullable: true })
  utmCampaign?: string;

  @Column({ nullable: true })
  utmTerm?: string;

  @Column({ nullable: true })
  utmContent?: string;

  @ManyToOne(() => Order)
  @JoinColumn()
  order!: Order;

  @EntityId()
  orderId!: ID;

  /**
   * This is the percentage of the order that is attributed to this UTM parameter.
   * Has a value of 0 to 1, and is determined based on the used Attribution Model.
   */
  @Column({ nullable: true, type: 'float' })
  attributedPercentage?: number;

  /**
   * The attribution model that was used to calculate the attributed percentage.
   * This is set when the attribution is calculated.
   */
  @Column({ nullable: true })
  attributionModel?: string;

  @Column(() => UtmOrderParameterCustomFields)
  customFields!: UtmOrderParameterCustomFields;
}
