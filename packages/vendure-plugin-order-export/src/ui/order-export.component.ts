import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import {
  OrderExportConfig,
  OrderExportConfigInput,
  OrderExportConfigsQuery,
  OrderExportResult,
  OrderExportResultList,
  OrderExportResultsQuery,
  OrderExportResultsQueryVariables,
  UpdateOrderExportConfigMutation,
  UpdateOrderExportConfigMutationVariables,
} from './generated/graphql';
import { getConfigs, getExports, saveConfig } from './queries.graphql';

@Component({
  selector: 'order-export-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <!-- strategy form -->
        <form class="form">
          <section class="form-block">
            <vdr-form-field label="Export" for="apiKey">
              <select
                class="custom-select"
                (change)="setStrategy($event.target.value)"
              >
                <option
                  *ngFor="let strategy of strategies"
                  [ngValue]="strategy.name"
                >
                  {{ strategy.name }}
                </option>
              </select>
            </vdr-form-field>
            <button class="btn btn-primary" (click)="export()">Export</button>
          </section>
        </form>
        <hr />
        <!-- Config form -->
        <h4>Settings</h4>
        <form class="form" [formGroup]="configForm">
          <section class="form-block">
            <vdr-form-field
              *ngFor="let arg of selectedStrategy?.arguments"
              [label]="arg.name"
              [for]="arg.name"
            >
              <input [id]="arg.name" type="text" [formControlName]="arg.name" />
            </vdr-form-field>
            <button
              class="btn btn-primary"
              (click)="save()"
              [disabled]="configForm.invalid || configForm.pristine"
            >
              Save
            </button>
          </section>
        </form>
        <hr />
        <h4>Exports</h4>

        <vdr-data-table
          [items]="exportList?.items"
          [itemsPerPage]="itemsPerPage"
          [totalItems]="exportList?.totalItems"
          [currentPage]="page"
          (pageChange)="setPageNumber($event)"
          (itemsPerPageChange)="setItemsPerPage($event)"
          [allSelected]="areAllSelected()"
          [isRowSelectedFn]="isSelected"
          (rowSelectChange)="toggleSelect($event)"
          (allSelectChange)="toggleSelectAll()"
        >
          <vdr-dt-column>Status</vdr-dt-column>
          <vdr-dt-column>Exported at</vdr-dt-column>
          <vdr-dt-column>Customer</vdr-dt-column>
          <vdr-dt-column>Order</vdr-dt-column>
          <ng-template let-order="item">
            <td class="left align-middle">
              <vdr-chip
                *ngIf="
                  order.successful === false || order.successful === true;
                  else not
                "
                [colorType]="order.successful ? 'success' : 'error'"
              >
                <ng-container *ngIf="order.successful; else failed">
                  <clr-icon shape="check-circle"></clr-icon>
                  Exported
                </ng-container>
                <ng-template #failed>
                  <clr-icon shape="exclamation-circle"></clr-icon>
                  Failed
                </ng-template>
              </vdr-chip>
              <vdr-chip> Not exported </vdr-chip>
            </td>
            <td class="left align-middle">
              {{ order.createdAt | date }}
            </td>
            <td class="left align-middle">{{ order.customerEmail }}</td>
            <td class="left align-middle">
              <a [routerLink]="['/orders', order.orderId]">
                {{ order.orderCode }}
              </a>
            </td>
          </ng-template>
        </vdr-data-table>
      </div>
    </div>
  `,
})
export class OrderExportComponent implements OnInit {
  strategies: OrderExportConfig[] = [];
  exportList: OrderExportResultList | undefined;
  selectedExports: OrderExportResult[] = [];
  selectedStrategy: OrderExportConfig | undefined;
  configForm: FormGroup;
  itemsPerPage = 10;
  page = 0;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.configForm = this.formBuilder.group({});
  }

  async ngOnInit(): Promise<void> {
    // get all strategies via GraphQL
    await this.dataService
      .query<OrderExportConfigsQuery>(getConfigs)
      .mapStream((result) => result.orderExportConfigs)
      .subscribe(
        (strategies) => {
          this.strategies = strategies;
          this.setStrategy(strategies[0].name);
        },
        (error) => {
          console.error(error);
          this.notificationService.error(
            'Error getting order export strategies'
          );
        }
      );
    await this.getExports();
  }

  setStrategy(strategyName: string): void {
    const strat = this.strategies.find(
      (strategy) => strategy.name === strategyName
    );
    if (!strat) {
      return console.error(`No strategy named ${strategyName}, found!`);
    }
    const formFields = this.configForm?.value || {};
    strat.arguments.forEach(
      (arg) => (formFields[arg.name] = [arg.value || ''])
    );
    this.configForm = this.formBuilder.group(formFields);
    this.selectedStrategy = strat;
  }

  async save(): Promise<void> {
    if (!this.selectedStrategy) {
      this.notificationService.error(`No order export strategy selected!`);
    }
    const strategy: OrderExportConfigInput = {
      name: this.selectedStrategy!.name,
      arguments: this.selectedStrategy!.arguments.map((arg) => ({
        name: arg.name,
        value: this.configForm.get(arg.name)?.value,
      })),
    };
    await this.dataService
      .mutate<
        UpdateOrderExportConfigMutation,
        UpdateOrderExportConfigMutationVariables
      >(saveConfig, { input: strategy })
      .subscribe(
        (result) => {
          this.strategies = result.updateOrderExportConfig;
          this.notificationService.success('common.notify-update-success', {
            entity: 'Order export settings',
          });
          const updatedStrategy = this.strategies.find(
            (s) => s.name === this.selectedStrategy?.name
          );
          if (updatedStrategy) {
            this.setStrategy(updatedStrategy.name);
          }
        },
        (error) => {
          console.error(error);
          this.notificationService.error('common.notify-update-error', {
            entity: 'Order export settings',
          });
        }
      );
  }

  async getExports() {
    await this.dataService
      .query<OrderExportResultsQuery, OrderExportResultsQueryVariables>(
        getExports,
        {
          filter: {
            itemsPerPage: this.itemsPerPage,
            page: this.page,
          },
        }
      )
      .mapStream((result) => result.orderExportResults)
      .subscribe(
        (list) => {
          this.exportList = list;
        },
        (error) => {
          console.error(error);
          this.notificationService.error('Error getting order exports');
        }
      );
  }

  async export(): Promise<void> {
    console.log('exportt');
  }

  async setPageNumber(page: number) {
    this.page = page;
    await this.getExports();
  }

  async setItemsPerPage(nrOfItems: number) {
    this.page = 0;
    this.itemsPerPage = Number(nrOfItems);
    await this.getExports();
  }

  isSelected = (row: OrderExportResult): boolean => {
    return !!this.selectedExports?.find((selected) => selected.id === row.id);
  };

  toggleSelect(row: OrderExportResult): void {
    if (this.isSelected(row)) {
      this.selectedExports = this.selectedExports.filter(
        (s) => s.id !== row.id
      );
    } else {
      this.selectedExports.push(row);
    }
  }

  toggleSelectAll() {
    if (this.areAllSelected()) {
      this.selectedExports = [];
    } else {
      this.selectedExports = this.exportList?.items || [];
    }
  }

  areAllSelected(): boolean {
    return this.selectedExports.length === this.exportList?.items.length;
  }
}
