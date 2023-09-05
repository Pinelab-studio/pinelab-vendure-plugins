import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import {
  getAvailableWebhookEventsQuery,
  getAvailableWebhookRequestTransformersQuery,
  getWebhooksQuery,
  setWebhooksMutation,
} from './queries';
import {
  Webhook,
  WebhookInput,
  WebhookRequestTransformer,
} from './graphql-types';

@Component({
  selector: 'webhook-component',
  templateUrl: './webhook.component.html',
})
export class WebhookComponent implements OnInit {
  webhooks: Webhook[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  eventName: string | undefined;
  requestTransformerName: string | undefined;
  url: string | undefined;
  showMessage = false;
  availableWeebhookEvents: string[] = [];
  filteredWeebhookEvents: string[] = [];
  avaiabelWebhookRequestTransformers: WebhookRequestTransformer[] = [];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.dataService
      .query(getAvailableWebhookEventsQuery)
      .single$.subscribe((e: any) => {
        this.filteredWeebhookEvents = this.availableWeebhookEvents =
          e.availableWebhookEvents;
      });
    this.dataService.query(getWebhooksQuery).single$.subscribe((s: any) => {
      this.webhooks = s.webhooks;
    });
    this.dataService
      .query(getAvailableWebhookRequestTransformersQuery)
      .single$.toPromise()
      .then((d: any) => {
        this.avaiabelWebhookRequestTransformers =
          d.availableWebhookRequestTransformers;
      });
  }

  setPageNumber(event: number) {
    this.currentPage = event;
  }

  setItemsPerPage(event: number) {
    this.itemsPerPage = event;
  }

  showCreateModal() {
    this.showMessage = true;
    this.eventName = '';
    this.requestTransformerName = '';
    this.url = '';
    this.changeDetector.detectChanges();
  }

  create() {
    if (
      this.url &&
      this.url !== '' &&
      this.eventName &&
      this.eventName !== ''
    ) {
      this.dataService
        .mutate(setWebhooksMutation, {
          webhooks: [
            ...this.webhooks.map((w: Webhook) => {
              return {
                event: w.event,
                transformerName: w.requestTransformer?.name,
                url: w.url,
              };
            }),
            {
              event: this.eventName,
              transformerName: this.requestTransformerName,
              url: this.url,
            },
          ],
        })
        .subscribe((s: any) => {
          this.showMessage = false;
          this.notificationService.success('Webhook created successfully');
          this.webhooks = s.setWebhooks;
          this.changeDetector.detectChanges();
        });
    } else {
      this.notificationService.error('Please enter all the required fields');
    }
  }

  deleteWeebhook(id: number) {
    this.webhooks = this.webhooks.filter((w: Webhook) => w.id != id);
    this.changeDetector.detectChanges();
    this.dataService
      .mutate(setWebhooksMutation, {
        webhooks: [
          ...this.webhooks.map((w: Webhook) => {
            return {
              event: w.event,
              transformerName: w.requestTransformer?.name,
              url: w.url,
            };
          }),
        ],
      })
      .subscribe((s: any) => {
        this.webhooks = s.setWebhooks;
        this.notificationService.success('Webhook deleted successfully');
      });
  }

  requestTransformerSelected(setRequestTransformerName?: string) {
    if (setRequestTransformerName) {
      this.filteredWeebhookEvents =
        this.avaiabelWebhookRequestTransformers.find(
          (v) => v.name === this.requestTransformerName
        )?.supportedEvents ?? [];
    } else if (this.requestTransformerName) {
      this.filteredWeebhookEvents =
        this.avaiabelWebhookRequestTransformers.find(
          (v) => v.name === this.requestTransformerName
        )?.supportedEvents ?? [];
    } else {
      this.filteredWeebhookEvents = this.availableWeebhookEvents;
    }
    this.eventName = this.filteredWeebhookEvents.find(
      (v) => v === this.eventName
    );
    this.changeDetector.detectChanges();
  }

  duplicate(requestTransformer: string, url: string) {
    this.requestTransformerName = requestTransformer;
    this.requestTransformerSelected(requestTransformer);
    this.url = url;
    this.showMessage = true;
    this.changeDetector.detectChanges();
  }
}
