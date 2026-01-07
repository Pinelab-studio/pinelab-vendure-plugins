import { Order, RequestContext, VendureEvent } from '@vendure/core';

export enum QLSOrderError {
  INCORRECT_POSTAL_CODE = 'INCORRECT_POSTAL_CODE',
  INCORRECT_HOUSE_NUMBER = 'INCORRECT_HOUSE_NUMBER',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * This event is emitted when an order fails to be pushed to QLS.
 */
export class QlsOrderFailedEvent extends VendureEvent {
  /**
   * The error code that caused the order to fail to be pushed to QLS.
   */
  public errorCode: QLSOrderError;
  constructor(
    public ctx: RequestContext,
    public order: Order,
    /**
     * The date and time the order failed to be pushed to QLS.
     */
    public failedAt: Date,
    /**
     * The full error response JSON from QLS.
     */
    public fullError: any
  ) {
    super();
    this.errorCode = getQLSErrorCode(fullError);
  }
}

export function getQLSErrorCode(errorResponse: JSON): QLSOrderError {
  const errorString = JSON.stringify(errorResponse);
  if (errorString.includes('containsNumber')) {
    return QLSOrderError.INCORRECT_HOUSE_NUMBER;
  }
  if (
    errorString.includes('validPostalCode') ||
    errorString.includes('needPostalCodeVerification')
  ) {
    return QLSOrderError.INCORRECT_POSTAL_CODE;
  }
  return QLSOrderError.UNKNOWN_ERROR;
}
