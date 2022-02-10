import { OrderExportArgument } from '../ui/generated/graphql';

interface ExportSuccess {
  orderCode: string;
  /**
   * Reference to the external platform. For example the uuid of the exported order
   */
  reference: string;
}

interface ExportFailure {
  orderCode: string;
  /**
   * Free textfield to show the admin what went wrong
   */
  error: string;
}

type ExportResult = ExportFailure | ExportSuccess;

export interface OrderExportStrategy {
  /**
   * Error results are not recorded if this function throws an error
   * @param args
   */
  exportOrders(args: OrderExportArgument[]): Promise<ExportResult[]>;
}
