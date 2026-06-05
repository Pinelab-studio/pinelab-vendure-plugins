import { AlertMessage } from '../types';

/**
 * Defines an outgoing notification channel (e.g. webhook, email, SMS).
 * Each notifier has a unique name and knows how to deliver an {@link AlertMessage}.
 */
export interface Notifier {
  /** Unique name; used as job-data discriminator and in logs */
  readonly name: string;

  /**
   * Deliver the alert message.
   * Throwing causes the JobQueue to retry the delivery.
   */
  notify(message: AlertMessage): Promise<void>;
}
