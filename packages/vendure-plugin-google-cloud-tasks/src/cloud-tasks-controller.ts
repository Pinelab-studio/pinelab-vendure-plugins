import { Request, Response } from 'express';
import {
  Controller,
  Post,
  Req,
  Get,
  Res,
  OnApplicationBootstrap,
  Param,
} from '@nestjs/common';
import {
  ConfigService,
  Ctx,
  Job,
  JsonCompatible,
  Logger,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { JobState } from '@vendure/common/lib/generated-types';
import { CloudTaskMessage, ROUTE } from './types';
import { Repository } from 'typeorm';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import {
  CloudTasksJobQueueStrategy,
  PROCESS_MAP,
} from './cloud-tasks-job-queue.strategy';
import { loggerCtx } from '@vendure/core/dist/job-queue/constants';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';
import { CloudTasksService } from './cloud-tasks-service';

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
      attemptsHeader
    );
    res.sendStatus(responseCode);
  }

  @Get('clear-jobs/:days')
  async clearJobs(
    @Req() req: Request,
    @Res() res: Response,
    @Param('days') daysString: string
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
          'Authorization'
        )}`,
        loggerCtx
      );
      return false;
    }
    return true;
  }
}
