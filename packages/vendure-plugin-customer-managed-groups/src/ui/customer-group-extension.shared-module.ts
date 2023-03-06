import {
  ChangeDetectionStrategy,
  Component,
  NgModule,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  DataService,
  FormInputComponent,
  registerFormInputComponent,
  SharedModule,
  ModalService,
} from '@vendure/admin-ui/core';
import { RelationCustomFieldConfig } from '@vendure/common/lib/generated-types';
import { Observable } from 'rxjs';
import { gql } from 'graphql-tag';

export const FIND_CUSTOMERS = gql`
  query findCustomers($emailAddress: String!) {
    customers(
      options: {
        filter: { emailAddress: { contains: $emailAddress } }
        take: 10
      }
    ) {
      items {
        emailAddress
      }
    }
  }
`;

@Component({
  selector: 'customer-group-admin-selector',
  template: `
    <div *ngIf="formControl.value as customer">
      Selected: <vdr-chip>{{ customer.emailAddress }}</vdr-chip>
    </div>

    <input
      type="text"
      name="searchTerm"
      (change)="search($event)"
      class="search-customer"
    />

    <select appendTo="body" [formControl]="formControl">
      <option [ngValue]="null">none</option>
      <option *ngFor="let item of customers$ | async" [ngValue]="item" selected>
        {{ item.emailAddress }}
      </option>
    </select>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerGroupAdminSelectorComponent
  implements OnInit, FormInputComponent<RelationCustomFieldConfig>
{
  readonly!: boolean;
  formControl!: FormControl;
  config!: RelationCustomFieldConfig;
  emailAddress = new FormControl('');

  customers$!: Observable<{ emailAddress: string; id: string }[]>;

  constructor(
    private dataService: DataService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.customers$ = this.dataService
      .query(FIND_CUSTOMERS, { emailAddress: 'hayden' }) // FIXME
      .mapSingle((result: any) => {
        console.log(result);
        return result.customers?.items ?? [];
      });
  }

  search(event: any) {
    console.log(event);
  }
}

@NgModule({
  imports: [SharedModule],
  declarations: [CustomerGroupAdminSelectorComponent],
  providers: [
    registerFormInputComponent(
      'customer-group-admin-selector',
      CustomerGroupAdminSelectorComponent
    ),
  ],
})
export class CustomerGroupExtensionSharedModule {}
