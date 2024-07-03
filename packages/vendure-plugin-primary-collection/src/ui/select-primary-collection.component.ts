import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OnInit } from '@angular/core';
import {
  StringCustomFieldConfig,
  FormInputComponent,
  CollectionFragment,
} from '@vendure/admin-ui/core';
import { DataService } from '@vendure/admin-ui/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ID } from '@vendure/common/lib/shared-types';
import { GET_PRODUCT_DETAIL } from './select-primary-collection.graphql';

export type ProductPrimaryCollection = {
  channelId: ID;
  collectionId: ID;
};

function idsAreEqual(id1?: ID, id2?: ID): boolean {
  if (id1 === undefined || id2 === undefined) {
    return false;
  }
  return id1.toString() === id2.toString();
}

@Component({
  template: `
    <select
      *ngIf="!productsCollectionsAreLoading"
      [formControl]="primaryCollectionFormControl"
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
  implements FormInputComponent<StringCustomFieldConfig>, OnInit, OnDestroy
{
  readonly!: boolean;
  isListInput = true;
  config!: StringCustomFieldConfig;
  formControl!: FormControl;
  primaryCollectionFormControl: FormControl;
  productsCollections!: CollectionFragment[];
  productsCollectionsAreLoading = true;
  productCollectionSubscription: Subscription;
  productDetailInActiveChannel$: Observable<any>;
  id!: string | null;
  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private activatedRoute: ActivatedRoute
  ) {}
  ngOnDestroy(): void {
    if (this.productCollectionSubscription) {
      this.productCollectionSubscription.unsubscribe();
    }
  }
  ngOnInit(): void {
    this.formControl.parent?.parent?.statusChanges.subscribe((_) => {
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
      const activeChannel$ = this.dataService.settings
        .getActiveChannel()
        .refetchOnChannelChange()
        .mapStream((data) => data.activeChannel);
      const productDetail$ = this.dataService
        .query(GET_PRODUCT_DETAIL, { id: this.id })
        .refetchOnChannelChange()
        .mapSingle((data: any) => data.product);
      const component = this;
      this.productDetailInActiveChannel$ = combineLatest(
        activeChannel$,
        productDetail$
      ).pipe(
        map(([activeChannel, product]) => {
          this.productsCollections = this.getCandidatePrimaryCollections(
            product,
            activeChannel.id
          );
          this.productsCollectionsAreLoading = false;
          this.primaryCollectionFormControl = new FormControl(
            product?.primaryCollection
          );
          this.primaryCollectionFormControl.valueChanges.subscribe(
            (selectedPrimaryCollection) => {
              component.updateComponentFormControl(
                activeChannel.id,
                selectedPrimaryCollection.id
              );
            }
          );
          this.cdr.markForCheck();
        })
      );
      this.productCollectionSubscription =
        this.productDetailInActiveChannel$.subscribe();
    }
  }

  compareFn(a: any, b: any) {
    return a?.id === b?.id;
  }

  updateComponentFormControl(
    activeChannelId: ID,
    selectedPrimaryCollectionId: ID
  ) {
    const allPrimaryCollectionsList =
      this.formControl.value?.map((primaryCollectionInChannel) =>
        JSON.parse(primaryCollectionInChannel)
      ) ?? ([] as ProductPrimaryCollection[]);
    let valueUpdated = false;
    for (const primaryCollectionDetail of allPrimaryCollectionsList) {
      if (idsAreEqual(primaryCollectionDetail.channelId, activeChannelId)) {
        primaryCollectionDetail.collectionId = selectedPrimaryCollectionId;
        valueUpdated = true;
      }
    }
    if (!valueUpdated) {
      allPrimaryCollectionsList.push({
        channelId: activeChannelId,
        collectionId: selectedPrimaryCollectionId,
      });
    }
    this.formControl.setValue(
      allPrimaryCollectionsList.map((v) => JSON.stringify(v))
    );
    this.formControl.markAsDirty();
  }

  getCandidatePrimaryCollections(product: any, activeChannelId: ID) {
    return product?.collections.filter((c) => {
      return (
        !c.isPrivate &&
        !!c.channels.find((channel) => idsAreEqual(channel.id, activeChannelId))
      );
    });
  }
}
