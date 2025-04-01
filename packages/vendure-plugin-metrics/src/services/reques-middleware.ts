import { Injectable, NestMiddleware, Req } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { RequestService } from './request-service';
import { Injector, Logger, OrderService } from '@vendure/core';
import { loggerCtx } from '../constants';

/**
 * Intercept requests and log them to count visitors
 */
@Injectable()
export class RequestMiddleware implements NestMiddleware {
  static requestService: RequestService;
  async use(req: Request, res: Response, next: NextFunction) {
    if (RequestMiddleware.requestService) {
      RequestMiddleware.requestService.logRequest(req);
    } else {
      Logger.error(
        'RequestService not initialized. Can not log requests...',
        loggerCtx
      );
    }
    next();
  }
}
