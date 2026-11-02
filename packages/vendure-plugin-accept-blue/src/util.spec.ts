import { describe, expect, it } from 'vitest';
import { getNrOfBillingCyclesLeft } from './util';

describe('getNrOfBillingCyclesLeft', () => {
  it('Starts on monday and ends the next tuesday  with frequency weekly', () => {
    const startDate = new Date('2024-11-18');
    const endDate = new Date('2024-11-19');
    const frequency = 'weekly';
    const result = getNrOfBillingCyclesLeft(startDate, endDate, frequency);
    expect(result).toBe(1);
  });

  it('Starts on monday and ends the tuesday 1 week later  with frequency weekly', () => {
    const startDate = new Date('2024-11-18');
    const endDate = new Date('2024-11-26');
    const frequency = 'weekly';
    const result = getNrOfBillingCyclesLeft(startDate, endDate, frequency);
    expect(result).toBe(2);
  });

  it('Starts on monday and ends the sunday 1 week later  with frequency weekly', () => {
    const startDate = new Date('2024-11-18');
    const endDate = new Date('2024-12-01');
    const frequency = 'weekly';
    const result = getNrOfBillingCyclesLeft(startDate, endDate, frequency);
    expect(result).toBe(2);
  });

  it('Starts on monday and ends the monday 1 week later with frequency weekly', () => {
    const startDate = new Date('2024-11-18');
    const endDate = new Date('2024-11-25');
    const frequency = 'weekly';
    const result = getNrOfBillingCyclesLeft(startDate, endDate, frequency);
    expect(result).toBe(1);
  });
  it('Starts monday and ends the monday 1 week later with frequency daily', () => {
    const startDate = new Date('2024-11-18');
    const endDate = new Date('2024-11-25');
    const frequency = 'daily';
    const result = getNrOfBillingCyclesLeft(startDate, endDate, frequency);
    expect(result).toBe(7);
  });
});
