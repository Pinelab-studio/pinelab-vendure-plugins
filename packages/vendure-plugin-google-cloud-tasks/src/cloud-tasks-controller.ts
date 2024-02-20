import {
  Controller,
  Get,
  OnApplicationBootstrap,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Request, Response } from 'express';
import { CloudTasksService } from './cloud-tasks-service';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { loggerCtx } from './constants';
import { CloudTaskMessage, ROUTE } from './types';

@Controller(ROUTE)
export class CloudTasksController implements OnApplicationBootstrap {
  private applicationBootstrapped = false;

  constructor(private readonly service: CloudTasksService) {}

  onApplicationBootstrap() {
    this.applicationBootstrapped = true;
  }

  @Post('handler')
  async handler(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.applicationBootstrapped) {
      // Don't try to handle jobs when application isn't fully bootstrapped
      res.sendStatus(500);
      return;
    }
    if (!this.isValidRequest(req)) {
      res.sendStatus(401);
      return;
    }
    const message: CloudTaskMessage = req.body;
    const attemptsHeader = req.header('x-cloudtasks-taskretrycount');
    const responseCode = await this.service.handleIncomingJob(
      message,
      attemptsHeader,
    );
    res.sendStatus(responseCode);
  }

  @Get('clear-jobs/:days')
  async clearJobs(
    @Req() req: Request,
    @Res() res: Response,
    @Param('days') daysString: string,
  ): Promise<void> {
    if (!this.isValidRequest(req)) {
      res.sendStatus(401);
      return;
    }
    if (isNaN(parseInt(daysString))) {
      res.status(400).send(`${daysString} is not a number`);
      return;
    }
    const days = parseInt(daysString);
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await this.service.removeAllJobs(daysAgo);
    res.sendStatus(200);
  }

  private isValidRequest(req: Request): boolean {
    if (
      req.header('Authorization') !==
      `Bearer ${CloudTasksPlugin.options.authSecret}`
    ) {
      Logger.warn(
        `Unauthorized incoming webhook with Auth header ${req.header(
          'Authorization',
        )}`,
        loggerCtx,
      );
      return false;
    }
    return true;
  }
}
