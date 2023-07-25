import { EmailEventHandler, EmailEventListener } from '@vendure/email-plugin';
import {
  Injector,
  OrderLine,
  OrderPlacedEvent,
  RequestContext,
  StockLevelService,
  VendureEvent,
} from '@vendure/core';

type StockEmailRecipientsFn = (
  injector: Injector,
  event: VendureEvent
) => Promise<string[]> | string[];

export interface LowStockEmailOptions {
  /**
   * Send email below 'threshold'
   */
  threshold: number;
  /**
   * Array of emailaddresses or a function that dynamically resolves an array of emailadresses
   */
  emailRecipients: string[] | StockEmailRecipientsFn;
  /**
   * The subject used in email subject
   */
  subject: string;
}

/**
 * Send an email after order placement when the stock of a variant is below a
 * certain threshold after an order has been placed.
 */
export function createLowStockEmailHandler({
  threshold,
  subject,
  emailRecipients,
}: LowStockEmailOptions): EmailEventHandler<any, any> {
  let stockLevelService: StockLevelService;
  return (
    new EmailEventListener('low-stock')
      .on(OrderPlacedEvent)
      // .filter(
      //   (event) =>
      //     !!event.order.lines.find((line) =>
      //       droppedBelowThreshold(threshold, line, event.ctx)
      //     )
      // )
      .loadData(async ({ event, injector }) => {
        stockLevelService = injector.get(StockLevelService);
        const dropped = !!event.order.lines.find(
          async (line) =>
            await droppedBelowThreshold(
              threshold,
              line,
              event.ctx,
              stockLevelService
            )
        );
        if (Array.isArray(emailRecipients)) {
          return { adminRecipients: emailRecipients };
        }
        return {
          adminRecipients: dropped
            ? await emailRecipients(injector, event)
            : [],
        };
      })
      .setRecipient((event) => event.data.adminRecipients.join(','))
      .setFrom(`{{ fromAddress }}`)
      .setSubject(subject)
      .setTemplateVars((event) => {
        const lines = event.order.lines.filter(
          async (line) =>
            await droppedBelowThreshold(
              threshold,
              line,
              event.ctx,
              stockLevelService
            )
        );
        return {
          lines,
        };
      })
  );
}

/**
 * Returns true if this orderLine made the stocklevel drop below the threshold
 */
export async function droppedBelowThreshold(
  threshold: number,
  line: OrderLine,
  ctx: RequestContext,
  stockLevelService: StockLevelService
): Promise<boolean> {
  const { productVariant, quantity } = line;
  const variantStocks = await stockLevelService.getAvailableStock(
    ctx,
    productVariant.id
  );
  const stockAfterOrder = variantStocks.stockOnHand;
  const stockBeforeOrder = stockAfterOrder + quantity;
  return stockAfterOrder <= threshold && stockBeforeOrder >= threshold;
}
