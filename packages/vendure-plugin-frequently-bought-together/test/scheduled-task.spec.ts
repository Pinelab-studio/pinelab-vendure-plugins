import { describe, it, expect } from 'vitest';
import { buildFrequentlyBoughtTogetherTask } from '../src/config/frequently-bought-together-task';

const TASK_ID = 'frequently-bought-together-calculation';

describe('buildFrequentlyBoughtTogetherTask', () => {
  it('Returns the task with its default schedule when no option is given', () => {
    const task = buildFrequentlyBoughtTogetherTask();
    expect(task.id).toBe(TASK_ID);
  });

  // Mutating case runs last: ScheduledTask.configure() mutates the singleton.
  it('Overrides the schedule (run time) when an option is given', () => {
    const task = buildFrequentlyBoughtTogetherTask({ schedule: '0 4 * * *' });
    expect(task.id).toBe(TASK_ID);
    expect(task.options.schedule).toBe('0 4 * * *');
  });
});
