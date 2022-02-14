import {
  ExportedOrder,
  OrderExportArgument,
  OrderExportArgumentInput,
} from '../ui/generated/graphql';
import { Order } from '@vendure/core';

export type ExportResult = Pick<ExportedOrder, 'reference' | 'message'>;

export interface OrderExportStrategy {
  name: string;
  arguments: OrderExportArgument[];

  /**
   * If the function doesn't throw an error it will be recorded as a succesful export.
   * If an error is thrown, the export is recoreded as failed and the error.message is also recorded
   * @param args
   * @param order including shippingAddress, billingAddress, order.lines, order.lines.variant
   */
  exportOrder(args: OrderExportArgument[], order: Order): Promise<ExportResult>;
}
