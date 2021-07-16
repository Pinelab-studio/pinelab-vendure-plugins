import { Controller, Post, Req, HttpException } from '@nestjs/common';
import { Job, JsonCompatible, LanguageCode, Logger } from '@vendure/core';
import { CloudTaskMessage, CloudTasksPlugin } from './cloud-tasks.plugin';
import { Request } from 'express';
import { CloudTasksJobQueueStrategy } from './cloud-tasks-job-queue.strategy';
import { JobState } from '@vendure/common/lib/generated-types';

@Controller('cloud-tasks')
export class CloudTasksHandler {
  @Post('handler')
  async handler(@Req() req: Request): Promise<void> {
    if (
      req.header('Authorization') !==
      `Bearer ${CloudTasksPlugin.options.authSecret}`
    ) {
      throw new HttpException('You are not authorized to do this', 401);
    }
    const message: CloudTaskMessage = req.body;
    Logger.debug(
      `Received Cloud Task message ${message.id}`,
      CloudTasksPlugin.loggerCtx
    );
    const processFn = CloudTasksJobQueueStrategy.processMap.get(
      message.queueName
    );
    if (!processFn) {
      throw new HttpException(
        `No process function found for queue ${message.queueName}`,
        500
      );
    }
    const attemptsHeader = req.header('x-cloudtasks-taskretrycount') ?? 0;
    const attempts = attemptsHeader ? parseInt(attemptsHeader) : 0;
    const job = new Job({
      id: message.id,
      queueName: message.queueName,
      data: message.data as JsonCompatible<unknown>,
      attempts: attempts,
      state: JobState.RUNNING,
      startedAt: new Date(),
      createdAt: message.createdAt,
    });
    try {
      await processFn(job);
      Logger.debug(
        `Successfully handled ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx
      );
    } catch (error) {
      Logger.error(
        `Failed to handle message ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx,
        error
      );
    }
  }
}
