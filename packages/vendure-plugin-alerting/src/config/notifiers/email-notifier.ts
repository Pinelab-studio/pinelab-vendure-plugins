import { AlertMessage } from '../../types';
import { Notifier } from '../notifier';
import {
  EmailDetails,
  EmailSender,
  EmailTransportOptions,
  NodemailerEmailSender,
} from '@vendure/email-plugin';

export interface EmailNotifierConfig {
  /** Unique name; used as job-data discriminator and in logs */
  name: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Vendure email transport options (e.g. SMTP, SES, file) */
  transport: EmailTransportOptions;
  /** Optional custom EmailSender; defaults to NodemailerEmailSender */
  emailSender?: EmailSender;
}

/**
 * Notifier that sends alert messages as plain-text emails via Vendure's
 * built-in {@link NodemailerEmailSender}. No templates are required —
 * the alert subject and text are sent directly as the email subject and body.
 */
export class EmailNotifier implements Notifier {
  readonly name: string;

  constructor(private config: EmailNotifierConfig) {
    this.name = config.name;
  }

  async notify(message: AlertMessage): Promise<void> {
    const emailDetails: EmailDetails = {
      from: this.config.from,
      recipient: this.config.to,
      subject: message.subject,
      body: message.text,
      attachments: [],
    };
    const sender = this.config.emailSender ?? new NodemailerEmailSender();
    await sender.send(emailDetails, this.config.transport);
  }
}
