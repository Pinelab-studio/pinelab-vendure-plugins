import {
  CustomDetailComponent,
  DataService,
  ModalService,
  SharedModule,
} from '@vendure/admin-ui/core';
import { FormGroup } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Component, OnInit } from '@angular/core';
import { unique } from '@vendure/common/lib/unique';
import { shareReplay } from 'rxjs/operators';
import { GET_REQUIRED_FACETS } from './queries.graphql';
import {
  GetRequiredFacetsQuery,
  GetRequiredFacetsQueryVariables,
} from '../generated/graphql';

type RequiredFacetValueStatus = 'complete' | 'incomplete';
type RequiredFacetWithValues = GetRequiredFacetsQuery['requiredFacets'][number];

@Component({
  imports: [SharedModule],
  standalone: true,
  selector: 'selectable-facets',
  templateUrl: `./selectable-facets.component.html`,
  styleUrls: [`./selectable-facets.component.scss`],
})
export class SelectableFacetsComponent
  implements CustomDetailComponent, OnInit
{
  detailForm: FormGroup;
  entity$: Observable<any>;
  status$: Observable<RequiredFacetValueStatus>;
  requiredFacets$: Observable<
    Array<{
      facet: RequiredFacetWithValues;
      selectedValues: RequiredFacetWithValues['values'];
    }>
  >;

  constructor(
    private dataService: DataService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    const selectedFacetValueIds$ = this.detailForm
      .get(['facetValueIds'])!
      .valueChanges.pipe(
        startWith(this.detailForm.get(['facetValueIds'])!.value)
      );
    const possiblyRequiredFacets$ = this.dataService
      .query<GetRequiredFacetsQuery, GetRequiredFacetsQueryVariables>(
        GET_REQUIRED_FACETS,
        {},
        'cache-first'
      )
      .single$.pipe(
        map(({ requiredFacets }) =>
          requiredFacets.filter(
            ({ customFields }) =>
              customFields?.showOnProductDetail === true ||
              customFields?.showOnProductDetailIf?.length
          )
        )
      );
    this.requiredFacets$ = combineLatest(
      possiblyRequiredFacets$,
      selectedFacetValueIds$
    ).pipe(
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

  addFacetValue(facetValue: RequiredFacetWithValues['values'][number]) {
    const productGroup = this.getProductFormGroup();
    const currentFacetValueIds: string[] = productGroup.value.facetValueIds;
    productGroup.patchValue({
      facetValueIds: unique([...currentFacetValueIds, facetValue.id]),
    });
    productGroup.markAsDirty();
  }

  removeFacetValue({
    value: facetValue,
  }: {
    value: RequiredFacetWithValues['values'][number];
  }) {
    const productGroup = this.getProductFormGroup();
    const currentFacetValueIds: string[] = productGroup.value.facetValueIds;
    productGroup.patchValue({
      facetValueIds: unique([
        ...currentFacetValueIds.filter((id) => id !== facetValue.id),
      ]),
    });
    productGroup.markAsDirty();
  }

  private getProductFormGroup(): FormGroup {
    return this.detailForm as FormGroup;
  }
}
