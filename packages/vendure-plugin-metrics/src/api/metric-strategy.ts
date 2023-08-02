import { AdvancedMetricInterval, AdvancedMetricSummaryEntry, AdvancedMetricType } from "../ui/generated/graphql";
import { RequestContext } from '@vendure/core';
import { MetricData } from "./metrics.service";

export interface MetricStrategy<T extends Array> {
    code: string;
    /**
     * We need to know if the chart should format your metrics as
     *  numbers/amounts or as currency
     */
    metricType: AdvancedMetricType;

    /**
     * Title to display on the chart. 
     * Ctx can be used to localize the title
     */
    getTitle(ctx: RequestContext): string;

    loadData(ctx: RequestContext)

    /**
     * Calculate the datapoint for the given month
     * @param ctx 
     * @param interval 
     * @param monthNr 
     * @param data 
     */
    calculateDataPoint(
        ctx: RequestContext,
        monthNr: number,
        data: T
      ): AdvancedMetricSummaryEntry;
    


}