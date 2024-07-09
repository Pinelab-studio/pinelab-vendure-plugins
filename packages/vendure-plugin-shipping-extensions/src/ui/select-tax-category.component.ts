import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  StringCustomFieldConfig,
  SharedModule,
  FormInputComponent,
  TaxCategoryFragment,
  DataService,
} from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';

@Component({
  template: `
    <select name="taxCategoryId" [formControl]="formControl">
      <option
        *ngFor="let taxCategory of taxCategories$ | async"
        [value]="taxCategory.id"
      >
        {{ taxCategory.name }}
      </option>
    </select>
  `,
  standalone: true,
  imports: [SharedModule],
})
export class SelectTaxCategoryComponent
  implements FormInputComponent<StringCustomFieldConfig>, OnInit
{
  readonly: boolean;
  config: StringCustomFieldConfig;
  formControl: FormControl;
  taxCategories$: Observable<TaxCategoryFragment[]>;
  constructor(private dataService: DataService) {}
  ngOnInit(): void {
    this.taxCategories$ = this.dataService.settings
      .getTaxCategories({ take: 100 })
      .mapSingle((data) => data.taxCategories.items);
  }
  isListInput?: boolean | undefined;
}
