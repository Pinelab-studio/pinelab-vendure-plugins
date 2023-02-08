import { Component } from '@angular/core';
import {
  DataService,
  NotificationService,
  OrderDetailFragment,
  OrderHistoryEntryComponent,
  TimelineDisplayType,
  TimelineHistoryEntry,
} from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

@Component({
  selector: 'stripe-subscription-notification-component',
  template: `
    <span *ngIf="entry.data.valid">
      Created {{ entry.data.name }} subscription</span
    >
    <span *ngIf="!entry.data.valid">
      Failed to create {{ entry.data.name }} subscription
    </span>
    <a
      *ngIf="entry.data.subscriptionId"
      [href]="
        'https://dashboard.stripe.com/subscriptions/' +
        entry.data.subscriptionId
      "
      class="btn btn-link btn-sm details-button"
      target="_blank"
    >
      <clr-icon shape="export" size="12"></clr-icon>
    </a>
    <br />
    <vdr-history-entry-detail *ngIf="entry.data.error">
      <vdr-object-tree [value]="entry.data.error"></vdr-object-tree>
    </vdr-history-entry-detail>
    <vdr-history-entry-detail *ngIf="entry.data.pricing" title="pricing">
      <vdr-object-tree [value]="entry.data.pricing"></vdr-object-tree>
    </vdr-history-entry-detail>
  `,
})
export class HistoryEntryComponent implements OrderHistoryEntryComponent {
  entry!: TimelineHistoryEntry;
  order!: OrderDetailFragment;

  constructor() {}

  getDisplayType(entry: TimelineHistoryEntry): TimelineDisplayType {
    return entry.data.valid ? 'success' : 'error';
  }

  isFeatured(entry: TimelineHistoryEntry): boolean {
    return !entry.data.valid;
  }

  getName(entry: TimelineHistoryEntry): string {
    return 'Stripe Subscriptions';
  }

  getIconShape(entry: TimelineHistoryEntry) {
    return entry.data.valid ? undefined : 'exclamation-circle';
  }
}
