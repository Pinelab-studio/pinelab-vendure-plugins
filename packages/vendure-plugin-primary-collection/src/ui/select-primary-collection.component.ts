import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OnInit } from '@angular/core';
import {
  StringCustomFieldConfig,
  FormInputComponent,
  Collection,
  Product,
  Channel,
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

type CollectionWithChannel = Collection & {
  channels: Channel[];
};

type ProductWithPrimaryCollection = Omit<Product, 'collections'> & {
  primaryCollection: CollectionWithChannel;
  collections: CollectionWithChannel[];
};

type CollectionFragment = Partial<Collection> & {
  id: ID;
  name: string;
};

function idsAreEqual(id1?: ID, id2?: ID): boolean {
  if (id1 === undefined || id2 === undefined) {
    return false;
  }
  return id1.toString() === id2.toString();
}

@Component({
  standalone: false,
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
  config!: StringCustomFieldConfig;
  formControl!: FormControl<string>;
  primaryCollectionFormControl: FormControl;
  productsCollections!: Collection[];
  productsCollectionsAreLoading = true;
  productCollectionSubscription: Subscription;
  productDetailInActiveChannel$: Observable<void>;
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
    this.formControl.parent?.parent?.statusChanges.subscribe(() => {
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
        .query<{ product: ProductWithPrimaryCollection }, { id: string }>(
          GET_PRODUCT_DETAIL,
          { id: this.id }
        )
        .refetchOnChannelChange()
        .mapSingle(
          (data: { product: ProductWithPrimaryCollection }) => data.product
        );
      this.productDetailInActiveChannel$ = combineLatest(
        activeChannel$,
        productDetail$
      ).pipe(
        map(([activeChannel, product]) => {
          //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.productsCollections = this.getEligiblePrimaryCollections(
            product,
            //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            activeChannel.id
          );
          this.productsCollectionsAreLoading = false;
          this.primaryCollectionFormControl =
            new FormControl<CollectionFragment>(product?.primaryCollection);
          this.primaryCollectionFormControl.valueChanges.subscribe(
            (selectedPrimaryCollection: CollectionFragment) => {
              this.updateComponentFormControl(
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

  compareFn(a: Partial<Collection>, b: Partial<Collection>): boolean {
    return a?.id === b?.id;
  }

  updateComponentFormControl = (
    activeChannelId: ID,
    selectedPrimaryCollectionId: ID
  ): void => {
    const allPrimaryCollectionsList = JSON.parse(
      this.formControl.value ?? '[]'
    ) as ProductPrimaryCollection[];
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
    this.formControl.setValue(JSON.stringify(allPrimaryCollectionsList));
    this.formControl.markAsDirty();
  };

  getEligiblePrimaryCollections(
    product: ProductWithPrimaryCollection,
    activeChannelId: ID
  ): Collection[] {
    return product?.collections.filter((collection) => {
      return (
        !collection.isPrivate &&
        !!collection.channels.find((collectionChannel) =>
          idsAreEqual(collectionChannel.id, activeChannelId)
        )
      );
    });
  }
}
