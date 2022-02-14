import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import {
  AllOrderExportConfigsQuery,
  ExportedOrder,
  GetFailedOrdersQuery,
  OrderExportConfig,
  OrderExportConfigInput,
  UpdateOrderExportConfigMutation,
  UpdateOrderExportConfigMutationVariables,
} from './generated/graphql';
import { getConfigs, getFailedOrders, saveConfig } from './queries.graphql';

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
        <h4>Failed exports</h4>
        <hr />
        <h4>Last 20 exports</h4>
      </div>
    </div>
  `,
})
export class OrderExportComponent implements OnInit {
  strategies: OrderExportConfig[] = [];
  failedExports: ExportedOrder[] = [];
  selectedStrategy: OrderExportConfig | undefined;
  configForm: FormGroup;

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
      .query<AllOrderExportConfigsQuery>(getConfigs)
      .mapStream((result) => result.allOrderExportConfigs)
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
    await this.dataService
      .query<GetFailedOrdersQuery>(getFailedOrders)
      .mapStream((result) => result.allExportedOrders)
      .subscribe(
        (strategies) => {
          this.failedExports = strategies;
        },
        (error) => {
          console.error(error);
          this.notificationService.error('Error getting exported orders');
        }
      );
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

  async export(): Promise<void> {
    console.log('exportt');
  }
}
