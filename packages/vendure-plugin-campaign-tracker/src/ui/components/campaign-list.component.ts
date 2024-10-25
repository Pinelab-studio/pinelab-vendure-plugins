import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { TypedDocumentNode } from '@apollo/client';
import {
  DeleteAdministratorsMutationVariables,
  LogicalOperator,
  NotificationService,
  SharedModule,
  TypedBaseListComponent,
} from '@vendure/admin-ui/core';
import {
  Campaign,
  CampaignList,
  CreateCampaignMutation,
  CreateCampaignMutationVariables,
  DeleteCampaignMutation,
  DeleteCampaignMutationVariables,
  Scalars,
  UpdateCampaignMutation,
  UpdateCampaignMutationVariables,
} from '../generated/graphql';
import {
  CREATE_CAMPAIGN,
  DELETE_CAMPAIGN,
  GET_CAMPAIGNS,
  UPDATE_CAMPAIGN,
} from '../queries';

const GetCampaignsTypedDocument: TypedDocumentNode<{
  campaigns: CampaignList;
}> = GET_CAMPAIGNS;

@Component({
  selector: 'campaign-list',
  templateUrl: './campaign-list.component.html',
  styles: [
    `
      .modal-footer.campaign {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class CampaignListComponent extends TypedBaseListComponent<
  typeof GetCampaignsTypedDocument,
  'campaigns'
> {
  currencyCode: any;
  showModal = false;
  modalAction: 'Edit' | 'Create' = 'Create';
  currentCampaign = {
    id: '' as Scalars['ID'],
    name: '',
    code: '',
  };

  // Here we set up the sorting options that will be available
  // to use in the data table
  readonly sorts = this.createSortCollection()
    .defaultSort('createdAt', 'DESC')
    .addSort({ name: 'createdAt' })
    .addSort({ name: 'updatedAt' })
    .addSort({ name: 'code' })
    .addSort({ name: 'name' })
    .addSort({ name: 'revenueLast7days' })
    .addSort({ name: 'revenueLast30days' })
    .addSort({ name: 'revenueLast365days' })
    .connectToRoute(this.route);

  constructor(
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    super();
    super.configure({
      document: GetCampaignsTypedDocument,
      getItems: (data) => data.campaigns,
      setVariables: (skip, take) => ({
        options: {
          skip,
          take,
          filter: {
            name: {
              contains: this.searchTermControl.value,
            },
            code: {
              contains: this.searchTermControl.value,
            },
          },
          sort: this.sorts.createSortInput(),
        },
      }),
      refreshListOnChanges: [this.sorts.valueChanges],
    });
    this.dataService.settings.getActiveChannel().single$.subscribe((data) => {
      this.currencyCode = data.activeChannel.defaultCurrencyCode;
    });
  }

  createOrUpdate() {
    if (this.currentCampaign.id) {
      // Update
      this.dataService
        .mutate<UpdateCampaignMutation, UpdateCampaignMutationVariables>(
          UPDATE_CAMPAIGN,
          {
            id: this.currentCampaign.id,
            input: {
              code: this.currentCampaign.code,
              name: this.currentCampaign.name,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clearCurrentCampaign();
          this.notificationService.success('Saved');
          this.changeDetector.detectChanges();
        });
    } else {
      // Create new
      this.dataService
        .mutate<CreateCampaignMutation, CreateCampaignMutationVariables>(
          CREATE_CAMPAIGN,
          {
            input: {
              code: this.currentCampaign.code,
              name: this.currentCampaign.name,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clearCurrentCampaign();
          this.notificationService.success('Created');
          this.changeDetector.detectChanges();
          super.refresh();
        });
    }
  }

  create() {
    this.modalAction = 'Create';
    this.currentCampaign.id = '';
    this.currentCampaign.name = '';
    this.currentCampaign.code = '';
    this.showModal = true;
  }

  edit(campaign: Campaign) {
    this.modalAction = 'Edit';
    this.currentCampaign.id = campaign.id;
    this.currentCampaign.name = campaign.name;
    this.currentCampaign.code = campaign.code;
    this.showModal = true;
  }

  delete() {
    this.dataService
      .mutate<DeleteCampaignMutation, DeleteCampaignMutationVariables>(
        DELETE_CAMPAIGN,
        {
          id: this.currentCampaign.id,
        }
      )
      .subscribe((s: any) => {
        this.showModal = false;
        this.clearCurrentCampaign();
        this.notificationService.success('Deleted');
        this.changeDetector.detectChanges();
        super.refresh();
      });
  }

  clearCurrentCampaign() {
    this.currentCampaign.id = '';
    this.currentCampaign.code = '';
    this.currentCampaign.name = '';
  }
}
