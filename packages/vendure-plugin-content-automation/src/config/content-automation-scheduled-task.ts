import { ScheduledTask } from '@vendure/core';
import { ContentAutomationService } from '../services/content-automation.service';

/**
 * @description
 * Creates a job for every changed input of every strategy, channel and language.
 * Runs nightly, and can be run on demand via Vendure's built-in Scheduled Tasks
 * screen. Use `contentAutomationTask.configure()` to change the schedule or timeout.
 *
 * Runs at 02:00, before the content health scan at 03:00. This is clock ordering only:
 * the task only creates jobs, which may still be running when the health scan starts.
 * Keep this order when overriding either schedule.
 */
export const contentAutomationTask = new ScheduledTask({
  id: 'content-automation',
  description:
    'Generate content for all changed inputs of all content automation strategies',
  schedule: (cron) => cron.everyDayAt(2, 0),
  // Loading and comparing all inputs can take longer than the scheduler's default of 60 seconds.
  // A timed out task is marked as failed and unlocked while it keeps running, which allows overlapping runs.
  timeout: '1h',
  async execute({ injector }) {
    return injector.get(ContentAutomationService).createJobsForChangedInputs();
  },
});
