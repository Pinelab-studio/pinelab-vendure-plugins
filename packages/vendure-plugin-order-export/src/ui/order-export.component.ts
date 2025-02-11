import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  DataService,
  getServerLocation,
  LocalStorageService,
  NotificationService,
} from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

@Component({
  encapsulation: ViewEncapsulation.None, // Hide time picker on children of order export
  selector: 'order-export-component',
  styles: ['.time-picker { display: none !important; }'],
  template: `
    <div class="page-block">
      <h1 class="mb-2">Export orders</h1>
      <form class="form" [formGroup]="form" id="export-form">
        <section class="form-block">
          <div class="flex">
            <div>
              <label>{{ 'common.start-date' | translate }}</label>
              <vdr-datetime-picker
                required
                timeGranularityInterval="60"
                formControlName="startsAt"
              ></vdr-datetime-picker>
            </div>
            <div>
              <label>{{ 'common.end-date' | translate }}</label>
              <vdr-datetime-picker
                required
                timeGranularityInterval="60"
                formControlName="endsAt"
              ></vdr-datetime-picker>
            </div>
          </div>
          <br />
          <clr-select-container>
            <label>Export as</label>
            <select
              clrSelect
              name="options"
              formControlName="strategy"
              required
            >
              <option *ngFor="let strategy of strategies" [value]="strategy">
                {{ strategy }}
              </option>
            </select>
          </clr-select-container>
          <br />
          <button
            class="btn btn-primary"
            [disabled]="form.invalid || form.pristine"
            (click)="download()"
          >
            Export
          </button>
        </section>
      </form>
    </div>
  `,
})
export class OrderExportComponent implements OnInit {
  form: FormGroup;
  serverPath: string;
  strategies: string[] = [];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private notificationService: NotificationService,
    private localStorageService: LocalStorageService
  ) {
    this.form = this.formBuilder.group({
      startsAt: null,
      endsAt: null,
      strategy: null,
    });
    this.serverPath = getServerLocation();
  }

  ngOnInit(): void {
    this.dataService
      .query(
        gql`
          query availableOrderExportStrategies {
            availableOrderExportStrategies
          }
        `
      )
      .single$.subscribe((result: any) => {
        this.strategies = result.availableOrderExportStrategies;
        this.form.controls['strategy'].setValue(this.strategies?.[0]);
      });
  }

  async download(): Promise<void> {
    try {
      const res = await fetch(
        `${this.serverPath}/export-orders/export/${this.form.value.strategy}?startDate=${this.form.value.startsAt}&endDate=${this.form.value.endsAt}`,
        {
          headers: this.getHeaders(),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const header = res.headers.get('Content-Disposition');
      const parts = header!.split(';');
      const filename = parts[1].split('=')[1];
      const blob = await res.blob();
      await this.downloadBlob(blob, filename);
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err.message);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const channelToken = this.localStorageService.get('activeChannelToken');
    if (channelToken) {
      headers['vendure-token'] = channelToken;
    }
    const authToken = this.localStorageService.get('authToken');
    if (authToken) {
      headers.authorization = `Bearer ${authToken}`;
    }
    return headers;
  }

  private async downloadBlob(blob: Blob, fileName: string): Promise<void> {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.setAttribute('hidden', 'true');
    a.href = blobUrl;
    a.download = fileName;
    a.setAttribute('target', '_blank');
    a.click();
  }
}
