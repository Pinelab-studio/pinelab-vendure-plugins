import { Order, RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { QLSOrderError, QlsOrderFailedEvent } from './qls-order-failed-event';

describe('QlsOrderFailedEvent', () => {
  const mockCtx = {} as RequestContext;
  const mockOrder = { id: 1, code: 'ORDER-001' } as Order;
  const mockFailedAt = new Date('2026-01-03T04:34:52.473Z');

  it('sets errorCode to INCORRECT_HOUSE_NUMBER for containsNumber error', () => {
    const fullError = {
      errors: {
        receiver_contact: {
          housenumber: { containsNumber: 'Huisnummer bevat geen nummer' },
        },
      },
      pagination: null,
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.INCORRECT_HOUSE_NUMBER);
    expect(event.ctx).toBe(mockCtx);
    expect(event.order).toBe(mockOrder);
    expect(event.failedAt).toBe(mockFailedAt);
    expect(event.fullError).toBe(fullError);
  });

  it('sets errorCode to INCORRECT_POSTAL_CODE for validPostalCode error', () => {
    const fullError = {
      errors: {
        receiver_contact: {
          postalcode: { validPostalCode: 'Ongeldige indeling (NNNN)' },
        },
      },
      pagination: null,
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.INCORRECT_POSTAL_CODE);
  });

  it('sets errorCode to INCORRECT_POSTAL_CODE for needPostalCodeVerification error', () => {
    const fullError = {
      errors: {
        receiver_contact: {
          postalcode: { needPostalCodeVerification: 'Ongeldige postcode' },
        },
      },
      pagination: null,
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.INCORRECT_POSTAL_CODE);
  });

  it('sets errorCode to INCORRECT_POSTAL_CODE for combined postal code errors', () => {
    const fullError = {
      errors: {
        receiver_contact: {
          postalcode: {
            needPostalCodeVerification: 'Ongeldige postcode',
            validPostalCode: 'Ongeldige indeling (NNNN LL)',
          },
        },
      },
      pagination: null,
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.INCORRECT_POSTAL_CODE);
  });

  it('sets errorCode to UNKNOWN_ERROR for 502 Bad Gateway HTML response', () => {
    const fullError = {
      html: '<html> <head><title>502 Bad Gateway</title></head> <body> <center><h1>502 Bad Gateway</h1></center> <hr><center>nginx</center> </body> </html>',
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.UNKNOWN_ERROR);
  });

  it('sets errorCode to UNKNOWN_ERROR for unknown error format', () => {
    const fullError = {
      meta: { code: 500 },
      errors: { unknown: 'Some other error' },
    };
    const event = new QlsOrderFailedEvent(
      mockCtx,
      mockOrder,
      mockFailedAt,
      fullError
    );
    expect(event.errorCode).toBe(QLSOrderError.UNKNOWN_ERROR);
  });
});
