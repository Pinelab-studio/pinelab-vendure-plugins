import { Customer, CustomerService, Order, OrderService, RequestContext } from "@vendure/core";
import { INestApplication } from "@nestjs/common";

/**
 * Create order with status PaymentSettled
 */
export async function createSettledOrder(app: INestApplication, ctx: RequestContext, shippingMethodId = 1): Promise<Order> {
  const orderService = app.get(OrderService);
  const customerService = app.get(CustomerService);
  let order = await orderService.create(ctx);
  order = await orderService.addItemToOrder(ctx, order.id, "1", 2) as Order;
  const customer = await customerService.createOrUpdate(ctx, {
    emailAddress: "test@pinelab.studio",
    firstName: "Martijn",
    lastName: "from Pinelab"

  }) as Customer;
  await orderService.addCustomerToOrder(ctx, order.id, customer);
  await orderService.setShippingAddress(ctx, order.id, {
    countryCode: "NL",
    streetLine1: "Test street"
  });
  order = await orderService.setShippingMethod(ctx, order.id, shippingMethodId) as Order;
  await orderService.transitionToState(ctx, order.id, "ArrangingPayment");
  await orderService.addManualPaymentToOrder(ctx, {
    orderId: order.id,
    method: "manual payment",
    transactionId: "1234",
    metadata: 'stuff'
  });
  return await orderService.transitionToState(ctx, order.id, "PaymentSettled") as Order;

}
