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
  selector: 'goedgepickt-notification-component',
  template: `
    <span *ngIf="entry.data.valid"> Synced to {{ getName(entry) }} </span>
    <span *ngIf="!entry.data.valid">
      Failed to sync to {{ getName(entry) }}
    </span>
    <button (click)="mutate()" class="btn btn-link btn-sm details-button">
      <clr-icon shape="sync" size="16"></clr-icon>
    </button>
    <br />
    <vdr-history-entry-detail *ngIf="entry.data.error">
      <vdr-object-tree [value]="entry.data.error"></vdr-object-tree>
    </vdr-history-entry-detail>
  `,
})
export class HistoryEntryComponent implements OrderHistoryEntryComponent {
  entry!: TimelineHistoryEntry;
  order!: OrderDetailFragment;

  constructor(
    protected dataService: DataService,
    protected notificationService: NotificationService,
  ) {}

  async mutate(): Promise<void> {
    try {
      await this.dataService
        .mutate(
          gql`
          mutation {
              syncOrderToGoedgepickt(orderCode: "${this.order.code}")
          }
      `,
        )
        .toPromise();
      this.notificationService.success('Success');
    } catch (e: any) {
      this.notificationService.error('Error');
    }
  }

  getDisplayType(entry: TimelineHistoryEntry): TimelineDisplayType {
    return entry.data.valid ? 'success' : 'error';
  }

  getName(entry: TimelineHistoryEntry): string {
    return entry.data.name;
  }

  isFeatured(entry: TimelineHistoryEntry): boolean {
    return !entry.data.valid;
  }

  getIconShape(entry: TimelineHistoryEntry) {
    return entry.data.valid ? 'check-circle' : 'exclamation-circle';
  }
}
