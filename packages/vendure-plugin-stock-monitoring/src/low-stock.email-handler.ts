import { EmailEventHandler, EmailEventListener } from '@vendure/email-plugin';
import { OrderLine, OrderPlacedEvent } from '@vendure/core';
import { EmailUtil } from './email.util';

/**
 * Send an email after order placement when the stock of a variant is below a certain treshold
 */
export function createLowStockHandler(
  treshold: number
): EmailEventHandler<any, any> {
  return new EmailEventListener('low-stock')
    .on(OrderPlacedEvent)
    .filter(
      (event) =>
        !!event.order.lines.find((line) => isBelowTreshold(treshold, line))
    )
    .loadData(async ({ event, injector }) => {
      let adminRecipients = await EmailUtil.getAdminEmailsForChannel(
        injector,
        event.ctx
      );
      return {
        adminRecipients,
      };
    })
    .setRecipient((event) => event.data.adminRecipients.join(','))
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`Lage voorraad`)
    .setTemplateVars((event) => {
      const lines = event.order.lines.filter((line) =>
        isBelowTreshold(treshold, line)
      );
      return {
        lines,
      };
    });
}

/**
 * Returns true if this order made the stocklevel go below the treshold
 */
export function isBelowTreshold(treshold: number, line: OrderLine): boolean {
  const {
    productVariant: { stockOnHand },
    quantity,
  } = line;
  return stockOnHand <= treshold && stockOnHand + quantity >= treshold;
}
