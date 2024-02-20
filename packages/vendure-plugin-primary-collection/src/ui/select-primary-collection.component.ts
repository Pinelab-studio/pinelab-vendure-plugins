import { Component, ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OnInit } from '@angular/core';
import {
  IntCustomFieldConfig,
  FormInputComponent,
  CollectionFragment,
  COLLECTION_FRAGMENT,
} from '@vendure/admin-ui/core';
import { DataService } from '@vendure/admin-ui/core';
import { gql } from 'graphql-tag';
import { ActivatedRoute } from '@angular/router';
@Component({
  template: `
    <select
      [formControl]="formControl"
      [vdrDisabled]="readonly"
      [compareWith]="compareFn"
    >
      <option *ngFor="let option of productsCollections" [ngValue]="option">
        {{ option.name }}
      </option>
    </select>
  `,
})
export class SelectPrimaryCollectionComponent
  implements FormInputComponent<IntCustomFieldConfig>, OnInit
{
  readonly!: boolean;
  config!: IntCustomFieldConfig;
  formControl!: FormControl;
  productsCollections!: CollectionFragment[];
  productsCollectionsAreLoading = true;
  id!: string | null;
  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private activatedRoute: ActivatedRoute
  ) {}
  ngOnInit(): void {
    this.formControl.parent?.parent?.statusChanges.subscribe((s) => {
      if (
        this.formControl.pristine &&
        !this.formControl.value &&
        (this.productsCollections?.length ||
          this.productsCollectionsAreLoading) &&
        this.id !== 'create'
      ) {
        this.formControl.parent?.parent?.markAsPristine();
      }
    });
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    if (this.id && this.id !== 'create') {
      this.dataService.collection.getCollectionContents(this.id);
      this.dataService
        .query(
          gql`
            query ProductsCollection($id: ID) {
              product(id: $id) {
                collections {
                  ...Collection
                }
              }
            }
            ${COLLECTION_FRAGMENT}
          `,
          { id: this.id }
        )
        .single$.subscribe((d: any) => {
          this.productsCollections = d?.product?.collections;
          this.productsCollectionsAreLoading = false;
          this.cdr.markForCheck();
        });
    }
  }

  compareFn(a: any, b: any) {
    return a?.id === b?.id;
  }
}
