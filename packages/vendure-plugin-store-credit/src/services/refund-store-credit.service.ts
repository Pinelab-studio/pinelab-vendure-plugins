import { Injectable } from '@nestjs/common';
import {
  EventBus,
  ID,
  idsAreEqual,
  InternalServerError,
  Logger,
  Order,
  Payment,
  PaymentMethod,
  PaymentMethodService,
  Refund,
  RefundAmountError,
  RefundEvent,
  RefundOrderStateError,
  RefundStateTransitionError,
  RefundStateTransitionEvent,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { summate } from '@vendure/common/lib/shared-utils';
import { storeCreditPaymentHandler } from '../config/payment-method-handler';
import { RefundStateMachine } from '@vendure/core/dist/service/helpers/refund-state-machine/refund-state-machine';

@Injectable()
export class RefundStoreCreditService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly connection: TransactionalConnection,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly refundStateMachine: RefundStateMachine
  ) {}

  async refundOrder(
    ctx: RequestContext,
    paymentId: ID,
    amount: number,
    reason: string
  ) {
    const payment = await this.connection.getEntityOrThrow(
      ctx,
      Payment,
      paymentId,
      {
        relations: ['order'],
      }
    );
    const order = payment.order;
    if (
      order.state === 'AddingItems' ||
      order.state === 'ArrangingPayment' ||
      order.state === 'PaymentAuthorized'
    ) {
      return new RefundOrderStateError({ orderState: order.state });
    }

    const createdRefund = await this.createRefund(
      ctx,
      amount,
      reason,
      order,
      payment
    );

    if (createdRefund instanceof Refund) {
      await this.eventBus.publish(
        new RefundEvent(ctx, order, createdRefund, 'created')
      );
    }
    return createdRefund;
  }

  private async createRefund(
    ctx: RequestContext,
    amount: number,
    reason: string,
    order: Order,
    payment: Payment
  ): Promise<Refund | RefundStateTransitionError | RefundAmountError> {
    const orderWithRefunds = await this.connection.getEntityOrThrow(
      ctx,
      Order,
      order.id,
      {
        relations: ['payments', 'payments.refunds'],
      }
    );
    const paymentToRefund = orderWithRefunds.payments.find((p) =>
      idsAreEqual(p.id, payment.id)
    );
    if (!paymentToRefund) {
      throw new InternalServerError('Could not find a Payment to refund');
    }
    const refundableAmount =
      paymentToRefund.amount - this.getPaymentRefundTotal(paymentToRefund);
    if (refundableAmount < amount) {
      return new RefundAmountError({ maximumRefundable: refundableAmount });
    }
    const refundsCreated: Refund[] = [];
    const refundablePayments = orderWithRefunds.payments.filter((p) => {
      return this.getPaymentRefundTotal(p) < p.amount;
    });
    let primaryRefund: Refund | undefined;
    const refundedPaymentIds: ID[] = [];
    const orderLinesTotal = 0;
    const total = amount;
    const refundMax =
      orderWithRefunds.payments
        ?.map((p) => p.amount - this.getPaymentRefundTotal(p))
        .reduce((sum, amount) => sum + amount, 0) ?? 0;
    let refundOutstanding = Math.min(total, refundMax);
    do {
      const paymentToRefund =
        (refundedPaymentIds.length === 0 &&
          refundablePayments.find((p) => idsAreEqual(p.id, payment.id))) ||
        refundablePayments.find((p) => !refundedPaymentIds.includes(p.id));
      if (!paymentToRefund) {
        throw new InternalServerError('Could not find a Payment to refund');
      }
      const amountNotRefunded =
        paymentToRefund.amount - this.getPaymentRefundTotal(paymentToRefund);
      const constrainedTotal = Math.min(amountNotRefunded, refundOutstanding);
      let refund = new Refund({
        payment: paymentToRefund,
        total: constrainedTotal,
        reason,
        method: payment.method,
        state: 'Pending',
        metadata: {},
        adjustment: 0,
        shipping: 0,
        items: orderLinesTotal,
      });
      let paymentMethod: PaymentMethod | undefined;
      try {
        const methodAndHandler =
          await this.paymentMethodService.getMethodAndOperations(
            ctx,
            paymentToRefund.method
          );
        paymentMethod = methodAndHandler.paymentMethod;
      } catch (e) {
        Logger.warn(
          'Could not find a corresponding PaymentMethodHandler ' +
            `when creating a refund for the Payment with method "${paymentToRefund.method}"`
        );
      }
      const createRefundResult = await storeCreditPaymentHandler.createRefund(
        ctx,
        { amount, reason, paymentId: payment.id },
        constrainedTotal,
        order,
        paymentToRefund,
        paymentMethod!.handler.args,
        paymentMethod!
      );
      if (createRefundResult) {
        refund.transactionId = createRefundResult.transactionId || '';
        refund.metadata = createRefundResult.metadata || {};
      }
      refund = await this.connection.getRepository(ctx, Refund).save(refund);
      if (createRefundResult) {
        let finalize: () => Promise<any>;
        const fromState = refund.state;
        try {
          const result = await this.refundStateMachine.transition(
            ctx,
            order,
            refund,
            createRefundResult.state
          );
          finalize = result.finalize;
        } catch (e: any) {
          return new RefundStateTransitionError({
            transitionError: e.message,
            fromState,
            toState: createRefundResult.state,
          });
        }
        await this.connection
          .getRepository(ctx, Refund)
          .save(refund, { reload: false });
        await finalize();
        await this.eventBus.publish(
          new RefundStateTransitionEvent(
            fromState,
            createRefundResult.state,
            ctx,
            refund,
            order
          )
        );
      }

      if (primaryRefund == null) {
        primaryRefund = refund;
      }
      refundsCreated.push(refund);
      refundedPaymentIds.push(paymentToRefund.id);
      refundOutstanding = total - summate(refundsCreated, 'total');
    } while (0 < refundOutstanding);
    return primaryRefund;
  }

  private getPaymentRefundTotal(payment: Payment): number {
    const nonFailedRefunds =
      payment.refunds?.filter((refund) => refund.state !== 'Failed') ?? [];
    return summate(nonFailedRefunds, 'total');
  }
}
