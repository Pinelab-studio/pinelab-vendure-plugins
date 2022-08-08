import {
  Injector,
  InternalServerError,
  Logger,
  OrderService,
  RequestContext,
} from '@vendure/core';
import os from 'os';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { loggerCtx } from '../constants';

export interface ExportInput {
  ctx: RequestContext;
  orderService: OrderService;
  startDate: Date;
  endDate: Date;
}

export interface ExportStrategy {
  readonly name: string;
  /**
   * ContentType of the export file. For example "text/csv" or "application/pdf"
   */
  readonly contentType: string;
  /**
   * File extension without the ".", for example "csv" or "pdf"
   */
  readonly fileExtension: string;

  /**
   * Write your desired exportfile and return the filePath.
   * Your exportfile will be deleted after it has been streamed to the client
   */
  createExportFile(input: ExportInput): Promise<string>;
}

interface OrderRow {
  code: string;
  placedAt: string;
  total: string;
  totalWithTax: string;

  [key: number]: string | number;
}

export class DefaultExportStrategy implements ExportStrategy {
  readonly name = 'example-export';
  readonly contentType = 'text/csv';
  readonly fileExtension = 'csv';

  async createExportFile({
    ctx,
    startDate,
    endDate,
    orderService,
  }: ExportInput): Promise<string> {
    const orders = await orderService.findAll(ctx, {
      filter: {
        orderPlacedAt: {
          between: {
            start: startDate,
            end: endDate,
          },
        },
      },
    });
    if (orders.totalItems > orders.items.length) {
      // This is just a sample strategy, so this is oke
      throw new InternalServerError(
        'Too many orders, getting paginated orders is not implemented.'
      );
    }
    Logger.info(`Exporting ${orders.items.length} orders`, loggerCtx);
    const rows: OrderRow[] = orders.items.map((order) => ({
      code: order.code,
      placedAt: order.orderPlacedAt?.toDateString() || '',
      total: this.formatCurrency(order.total),
      totalWithTax: this.formatCurrency(order.totalWithTax),
    }));
    // Write to file
    const fileName = `${new Date().getTime()}-${startDate.getTime()}-${endDate.getTime()}.${
      this.fileExtension
    }`;
    const exportFile = path.join(os.tmpdir(), fileName);
    const csvWriter = createObjectCsvWriter({
      path: exportFile,
      header: [
        { id: 'code', title: 'order' },
        { id: 'placedAt', title: 'date' },
        { id: 'total', title: 'total' },
        { id: 'totalWithTax', title: 'totalWithTax' },
      ],
    });
    await csvWriter.writeRecords(rows);
    return exportFile;
  }

  private formatCurrency(value: number): string {
    return (value / 100).toFixed(2);
  }
}
