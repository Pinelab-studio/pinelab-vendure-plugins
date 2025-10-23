import { ID, Order } from '@vendure/core';
import { UtmOrderParameter } from './entities/utm-order-parameter.entity';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface UTMTrackerPluginInitOptions {
  attributionModel: AttributionModel;
  /**
   * Determine the maximum number of UTM parameters that can be added to an order.
   * Default is 5. If a customer adds more than this number, the oldest UTM parameters will be removed.
   */
  maxParametersPerOrder: number;
  /**
   * Any parameters older than this number of days will not be considered for attribution.
   * Default is 30 days.
   */
  maxAttributionAgeInDays: number;
}

export interface AttributionModel {
  /**
   * Determine the attribution percentage for each UTM parameter of the given order.
   * The parameters are sorted by updatedAt timestamp, ASC (oldest first)
   */
  calculateAttribution(
    utmParameters: UtmOrderParameter[],
    order: Order
  ): AttributionResult[];
}

export interface AttributionResult {
  utmParameterId: ID;
  attributionPercentage: number;
}

export interface UTMParameterInput {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}
