import { ExportResult, OrderExportArgument, OrderExportStrategy } from '../src';
import { Order } from '@vendure/core';

export class FakeExporter implements OrderExportStrategy {
  name = 'Fake exporter';
  arguments = [
    {
      name: 'Message',
      value: 'leave a message',
    },
    {
      name: 'Make it fail',
      value: '0',
    },
  ];

  async exportOrder(
    args: OrderExportArgument[],
    order: Order
  ): Promise<ExportResult> {
    const message = args.find((a) => a.name === 'Message')?.value;
    const shouldFail = args.find((a) => a.name === 'Make it fail')?.value;
    if (shouldFail === '1' || shouldFail === 'true') {
      throw Error(`${order.code} failed because of a test error!`);
    }
    return {
      message,
      reference: order.code,
      externalLink: '/orders/',
    };
  }
}
