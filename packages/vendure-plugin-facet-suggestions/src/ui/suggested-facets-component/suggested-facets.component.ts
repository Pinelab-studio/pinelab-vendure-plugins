import {
  CustomDetailComponent,
  DataService,
  SharedModule,
} from '@vendure/admin-ui/core';
import { FormGroup } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Component, OnInit } from '@angular/core';
import { unique } from '@vendure/common/lib/unique';
import { Facet } from '@vendure/common/lib/generated-types';
import { shareReplay } from 'rxjs/operators';
import { GET_REQUIRED_FACETS } from './queries.graphql';
import { FacetValue } from '@vendure/core';

type RequiredFacetValueStatus = 'complete' | 'incomplete';

@Component({
  imports: [SharedModule],
  standalone: true,
  selector: 'suggested-facets',
  templateUrl: `./suggested-facets.component.html`,
  styleUrls: [`./suggested-facets.component.scss`],
})
export class SuggestedFacetsComponent implements CustomDetailComponent, OnInit {
  detailForm: FormGroup;
  entity$: Observable<any>;
  status$: Observable<RequiredFacetValueStatus>;
  requiredFacets$: Observable<
    Array<{
      facet: Facet;
      selectedValues: FacetValue[];
    }>
  >;

  constructor(private dataService: DataService) {}

  ngOnInit() {
    const selectedFacetValueIds$ = this.detailForm
      .get(['facetValueIds'])!
      .valueChanges.pipe(
        startWith(this.detailForm.get(['facetValueIds'])!.value)
      );
    const possiblyRequiredFacets$ = this.dataService
      .query<any, any>(GET_REQUIRED_FACETS, {}, 'cache-first')
      .single$.pipe(
        map(({ requiredFacets }) =>
          requiredFacets.filter(
            ({ customFields }) =>
              customFields?.showOnProductDetail === true ||
              customFields?.showOnProductDetailIf?.length
          )
        )
      );
    this.requiredFacets$ = combineLatest([
      possiblyRequiredFacets$,
      selectedFacetValueIds$,
    ]).pipe(
      shareReplay(1),
      map(([facets, selectedFacetValueIds]) => {
        return facets
          .filter(
            ({ customFields }) =>
              customFields?.showOnProductDetail === true ||
              customFields?.showOnProductDetailIf?.find((f) =>
                selectedFacetValueIds.includes(f.id)
              )
          )
          .map((facet) => ({
            facet,
            selectedValues: facet.values.filter((value) =>
              selectedFacetValueIds.includes(value.id)
            ),
          }));
      })
    );
    this.status$ = this.requiredFacets$.pipe(
      map((items) =>
        items.every((i) => 0 < i.selectedValues.length)
          ? 'complete'
          : 'incomplete'
      )
    );
  }

  addFacetValue(facetValue: FacetValue) {
    const productGroup = this.getProductFormGroup();
    const currentFacetValueIds: string[] = productGroup.value.facetValueIds;
    productGroup.patchValue({
      facetValueIds: unique([...currentFacetValueIds, facetValue.id]),
    });
    productGroup.markAsDirty();
    productGroup.controls.facetValueIds.markAsDirty();
  }

  removeFacetValue(facetValue: FacetValue) {
    const productGroup = this.getProductFormGroup();
    const currentFacetValueIds: string[] = productGroup.value.facetValueIds;
    productGroup.patchValue({
      facetValueIds: unique([
        ...currentFacetValueIds.filter((id) => id !== facetValue.id),
      ]),
    });
    productGroup.markAsDirty();
    productGroup.controls.facetValueIds.markAsDirty();
  }

  private getProductFormGroup(): FormGroup {
    return this.detailForm as FormGroup;
  }
}
