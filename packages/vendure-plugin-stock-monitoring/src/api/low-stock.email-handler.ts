import { EmailEventHandler, EmailEventListener } from '@vendure/email-plugin';
import {
  Injector,
  OrderLine,
  OrderPlacedEvent,
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
  return new EmailEventListener('low-stock')
    .on(OrderPlacedEvent)
    .filter(
      (event) =>
        !!event.order.lines.find((line) =>
          droppedBelowThreshold(threshold, line)
        )
    )
    .loadData(async ({ event, injector }) => {
      if (Array.isArray(emailRecipients)) {
        return { adminRecipients: emailRecipients };
      }
      return {
        adminRecipients: await emailRecipients(injector, event),
      };
    })
    .setRecipient((event) => event.data.adminRecipients.join(','))
    .setFrom(`{{ fromAddress }}`)
    .setSubject(subject)
    .setTemplateVars((event) => {
      const lines = event.order.lines.filter((line) =>
        droppedBelowThreshold(threshold, line)
      );
      return {
        lines,
      };
    });
}

/**
 * Returns true if this orderLine made the stocklevel drop below the threshold
 */
export function droppedBelowThreshold(
  threshold: number,
  line: OrderLine
): boolean {
  const {
    productVariant: { stockOnHand: stockAfterOrder },
    quantity,
  } = line;
  const stockBeforeOrder = stockAfterOrder + quantity;
  return stockAfterOrder <= threshold && stockBeforeOrder >= threshold;
}
