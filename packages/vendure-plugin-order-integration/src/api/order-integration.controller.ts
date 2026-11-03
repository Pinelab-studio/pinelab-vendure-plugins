import { All, Controller, Inject, Param, Req, Res } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { asError } from 'catch-unknown';
import type { Request, Response } from 'express';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  OrderIntegrationPluginOptions,
  OrderIntegrationWebhookRequest,
  OrderIntegrationWebhookResponse,
} from '../types';

/**
 * Shared webhook controller: hands `/order-integration/:strategyName/:connectionId`
 * requests to the named strategy's `onWebhookReceived` (design §8).
 *
 * A webhook is handled within the HTTP request: nothing is queued or retried, and no
 * `RequestContext` is created, because the route values are untrusted until the strategy
 * has authenticated the request.
 */
@Controller('order-integration')
export class OrderIntegrationController {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS)
    protected readonly options: OrderIntegrationPluginOptions,
  ) {}

  /**
   * Routes a webhook to its strategy and writes the strategy's response. Unknown strategies,
   * and strategies without `onWebhookReceived`, get an empty 404 without invoking anything.
   * An error while building the request, running the hook or writing the response is logged
   * and answered with an empty 500, so no error details reach the caller.
   */
  @All(':strategyName/:connectionId')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Param('strategyName') strategyName: string,
    @Param('connectionId') connectionId: string,
  ): Promise<void> {
    const strategy = this.options.strategies.find(
      (candidate) => candidate.name === strategyName,
    );
    if (!strategy?.onWebhookReceived) {
      res.status(404).end();
      return;
    }
    try {
      const request = buildWebhookRequest(req, strategyName, connectionId);
      writeWebhookResponse(res, await strategy.onWebhookReceived(request));
    } catch (e) {
      const error = asError(e);
      // The connection id comes from the URL: JSON-encode it so it cannot forge log lines
      Logger.error(
        `Webhook ${req.method} for strategy '${strategyName}' (connection ${JSON.stringify(connectionId)}) failed: ${error.message}`,
        loggerCtx,
        error.stack,
      );
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  }
}

/**
 * Builds the request passed to the strategy. The raw body middleware stores the exact
 * bytes in `req.body`; body-parser leaves it undefined when the request has no body.
 */
function buildWebhookRequest(
  req: Request,
  strategyName: string,
  connectionId: string,
): OrderIntegrationWebhookRequest {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : new Uint8Array();
  return {
    route: { strategyName, connectionId },
    method: req.method,
    headers: req.headers,
    query: req.query,
    rawBody,
    body: req.is(['json', '+json']) ? parseJson(rawBody) : undefined,
  };
}

/** Parses UTF-8 encoded JSON, returning `undefined` when the bytes are not valid JSON. */
function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf-8'));
  } catch {
    return undefined;
  }
}

/** Writes the strategy's status code, headers and body to the HTTP response. */
function writeWebhookResponse(
  res: Response,
  { statusCode, headers, body }: OrderIntegrationWebhookResponse,
): void {
  res.status(statusCode);
  if (headers) {
    res.set(headers);
  }
  if (body === undefined) {
    res.end();
    return;
  }
  if (body instanceof Uint8Array) {
    // Express sends a Buffer as application/octet-stream unless a Content-Type was set
    res.send(Buffer.from(body));
    return;
  }
  if (typeof body !== 'string') {
    res.json(body);
    return;
  }
  // Without a Content-Type, Express would send a string as text/html
  if (!res.get('Content-Type')) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
  }
  res.send(body);
}
