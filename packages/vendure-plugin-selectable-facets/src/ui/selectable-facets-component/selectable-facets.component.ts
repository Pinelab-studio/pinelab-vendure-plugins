import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  CustomDetailComponent,
  DataService,
  Facet,
  FacetValue,
  SharedModule,
} from '@vendure/admin-ui/core';
import {
  UntypedFormGroup,
  FormGroup,
  FormArray,
  FormControl,
} from '@angular/forms';
import { Observable, pairwise, startWith } from 'rxjs';
import {
  GET_SHOW_ON_PRODUCT_DETAIL_FACETS,
  GET_SHOW_ON_PRODUCT_DETAIL_FACETS_IF,
} from './queries.graphql';
import { ID } from '@vendure/common/lib/shared-types';
import { unique } from '@vendure/common/lib/unique';
export type SelectableFacet = {
  showOnProductDetailFacetsControls: FacetValue[][];
  conditionalShowOnProductDetailFacetsControls: FacetValue[][];
};
@Component({
  selector: 'selectable-facets-component',
  templateUrl: './selectable-facets.component.html',
  styleUrls: ['./selectable-facets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class SelectableFacetsComponent
  implements CustomDetailComponent, OnInit
{
  entity$: Observable<any>;
  detailForm: UntypedFormGroup;
  showOnProductDetailFacets: Facet[];
  conditionalShowOnProductDetailFacets: Facet[] = [];
  formGroup: UntypedFormGroup;
  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit(): void {
    // const component= this;
    this.dataService
      .query(GET_SHOW_ON_PRODUCT_DETAIL_FACETS)
      .stream$.subscribe((data: any) => {
        this.showOnProductDetailFacets = data.showOnProductDetailFacets;
        // console.log(this.showOnProductDetailFacets,'this.showOnProductDetailFacets')
        if (this.showOnProductDetailFacets?.length) {
          this.formGroup = new FormGroup({
            showOnProductDetailFacetsControls: new FormArray(
              this.showOnProductDetailFacets.map(
                (f) => new FormControl<FacetValue[]>([])
              )
            ),
            conditionalShowOnProductDetailFacetsControls: new FormArray([]),
          });
          this.takeFacetValuesFromDetailFormGroup();
          const emptyValue: SelectableFacet = {
            showOnProductDetailFacetsControls: [],
            conditionalShowOnProductDetailFacetsControls: [],
          };
          this.formGroup.valueChanges
            .pipe(startWith(emptyValue), pairwise())
            .subscribe(([prev, next]: [SelectableFacet, SelectableFacet]) => {
              // console.log(prev,next,'selam lalem------')
              const nextFlattenedFacetList =
                next.conditionalShowOnProductDetailFacetsControls.flat();
              const nextMerged = next.showOnProductDetailFacetsControls
                .flat()
                .concat(nextFlattenedFacetList);
              const prevFlattenedFacetList =
                prev.conditionalShowOnProductDetailFacetsControls.flat();
              const prevMerged = prev.showOnProductDetailFacetsControls
                .flat()
                .concat(prevFlattenedFacetList);
              this.updateProductDetailFormGroup(
                nextMerged.map((fV) => fV.id),
                prevMerged.map((fV) => fV.id)
              );
              this.getConditionalShowOnProductDetailFacets(nextMerged);
            });
          (
            this.detailForm.get('facetValueIds') as FormControl
          ).valueChanges.subscribe((v) => {
            this.takeFacetValuesFromDetailFormGroup();
          });
          this.takeFacetValuesFromDetailFormGroup();
          // this.assignValueChangeListener();
          this.cdr.detectChanges();
        }
      });
  }

  takeFacetValuesFromDetailFormGroup() {
    const existingProductFacetValueIds = this.detailForm.get('facetValueIds')
      ?.value as ID[];
    // const selectedFacetValuesForFacets:FacetValue[][]=[]
    if (existingProductFacetValueIds?.length) {
      for (
        let possiblySelectedFacetIndex = 0;
        possiblySelectedFacetIndex < this.showOnProductDetailFacets.length;
        possiblySelectedFacetIndex++
      ) {
        const facet =
          this.showOnProductDetailFacets[possiblySelectedFacetIndex];
        // selectedFacetValuesForFacets.push(facet.values.filter((fv)=> exsitingProductFacetValueIds.find((e)=> e == fv.id)));
        const filtered = facet.values.filter((fv) =>
          existingProductFacetValueIds.find(
            (facetValueId) => facetValueId == fv.id
          )
        );
        (this.formGroup.get('showOnProductDetailFacetsControls') as FormArray)
          .at(possiblySelectedFacetIndex)
          .setValue(filtered);
      }
      for (
        let possiblySelectedFacetIndex = 0;
        possiblySelectedFacetIndex <
        this.conditionalShowOnProductDetailFacets.length;
        possiblySelectedFacetIndex++
      ) {
        const facet =
          this.conditionalShowOnProductDetailFacets[possiblySelectedFacetIndex];
        // selectedFacetValuesForFacets.push(facet.values.filter((fv)=> exsitingProductFacetValueIds.find((e)=> e == fv.id)));
        const filtered = facet.values.filter((fv) =>
          existingProductFacetValueIds.find(
            (facetValueId) => facetValueId == fv.id
          )
        );
        (
          this.formGroup.get(
            'conditionalShowOnProductDetailFacetsControls'
          ) as FormArray
        )
          .at(possiblySelectedFacetIndex)
          .setValue(filtered);
      }
      this.cdr.markForCheck();
    }
  }

  // formGroupsUpdateCallBack(v: {showOnProductDetailFacetsControls: FacetValue[][], conditionalShowOnProductDetailFacetsControls: FacetValue[][]}){
  //   const flattenedFacetList= v.conditionalShowOnProductDetailFacetsControls.flat();
  //   const merged= v.showOnProductDetailFacetsControls.flat().concat(flattenedFacetList);
  //   this.updateProductDetailFormGroup(merged);
  //   this.getconditionalShowOnProductDetailFacets(merged)
  // }

  // assignValueChangeListener(){
  //   this.formGroup.valueChanges.subscribe(this.formGroupsUpdateCallBack)
  // }

  updateProductDetailFormGroup(newValueIds: ID[], oldValueIds: ID[]) {
    const detailFormValueIds = this.detailForm.get('facetValueIds')
      ?.value as ID[];
    // if the facet value exists in both oldValuesIds and detailFormValueIds discard it
    // if the facet value id exists in detailFormValueIds but not in oldValuesIds keep it
    // keep all the values in newValueIds
    const mergedValueIds = this.mergeOldIdsAndProductDetailFromIds(
      oldValueIds,
      detailFormValueIds
    );
    const finalValueIds = [
      ...new Set([...mergedValueIds, ...newValueIds]),
    ].filter((v) => v && v != '');
    //to prevent infinite loop
    console.log(
      finalValueIds,
      'finalValueIds',
      detailFormValueIds,
      'detailFormValueIds',
      oldValueIds,
      'oldValueIds'
    );
    if (
      !this.doTheseListsContainTheSameElements(
        finalValueIds,
        detailFormValueIds
      )
    ) {
      this.detailForm.get('facetValueIds')?.setValue([...finalValueIds]);
      this.detailForm.markAsDirty();
    }
  }

  doTheseListsContainTheSameElements(idList1: ID[], idList2: ID[]): boolean {
    for (let id1 of idList1) {
      let matchFound = false;
      for (let id2 of idList2) {
        if (id1 === id2) {
          matchFound = true;
        }
      }
      if (!matchFound) {
        return false;
      }
    }
    return true;
  }

  /**
   * if the facet value exists in both oldValuesIds and detailFormValueIds discard it
   * and if the facet value  exists in only either detailFormValueIds but not in oldValuesIds keep it
   * @param oldValueIds
   * @param detailFormValueIds
   * @returns
   */
  mergeOldIdsAndProductDetailFromIds(
    oldValueIds: ID[],
    detailFormValueIds: ID[]
  ): ID[] {
    const mergedValueIds: ID[] = [];
    for (let facetValueId of detailFormValueIds) {
      if (!oldValueIds.some((id) => id === facetValueId)) {
        mergedValueIds.push(facetValueId);
      }
    }
    return mergedValueIds;
  }

  getConditionalShowOnProductDetailFacets(facetValues: FacetValue[]) {
    const facetValueIds = facetValues.map((f) => f.id);
    console.log(facetValueIds, 'facetValueIds before call');
    const component = this;
    this.dataService
      .query(GET_SHOW_ON_PRODUCT_DETAIL_FACETS_IF, { facetValueIds })
      .stream$.subscribe((data: any) => {
        const facetList: Facet[] = data.showOnProductDetailForFacets;
        const detailFormValueIds = this.detailForm.get('facetValueIds')
          ?.value as ID[];
        console.log(facetList, 'facetList');
        //create new formcontrols for those which exist in facetList but not in conditionalShowOnProductDetailFacets
        const [newControls, newFacets, newFacetValueIds] =
          this.createFormControlsForNewFacets(facetList, detailFormValueIds);
        //keep the FormControls whose Facet in both
        const [existingControls, existingFacets, selectedFacetValueIds] =
          this.keepFormControlsForExistingFacets(facetList);
        const upcomingFacets = [...existingFacets, ...newFacets];
        const oldValueIds = upcomingFacets
          .map((f) => f.values.map((v) => v.id))
          .flat();
        this.conditionalShowOnProductDetailFacets = upcomingFacets;
        //update the parent formGroup facetValueIds
        // this.updateProductDetailFormGroup(facetValues.map((f)=> f.id), oldValueIds);
        this.updateProductDetailFormGroup(
          [...selectedFacetValueIds, ...newFacetValueIds],
          oldValueIds
        );

        this.formGroup = new FormGroup({
          showOnProductDetailFacetsControls: this.formGroup.get(
            'showOnProductDetailFacetsControls'
          ) as FormArray,
          conditionalShowOnProductDetailFacetsControls: new FormArray([
            ...existingControls,
            ...newControls,
          ]),
        });
        // this.assignValueChangeListener();
        const firstValue: SelectableFacet = {
          showOnProductDetailFacetsControls: this.formGroup.get(
            'showOnProductDetailFacetsControls'
          )?.value as FacetValue[][],
          conditionalShowOnProductDetailFacetsControls: upcomingFacets.map(
            (f) => f.values
          ),
        };
        this.formGroup.valueChanges
          .pipe(startWith(firstValue), pairwise())
          .subscribe(([prev, next]: [SelectableFacet, SelectableFacet]) => {
            const nextflattenedFacetList =
              next.conditionalShowOnProductDetailFacetsControls.flat();
            const nextMerged = next.showOnProductDetailFacetsControls
              .flat()
              .concat(nextflattenedFacetList);
            const nextMergedfacetValueIds = nextMerged.map((fV) => fV.id);
            const prevFlattenedFacetList =
              prev.conditionalShowOnProductDetailFacetsControls.flat();
            const prevMerged = prev.showOnProductDetailFacetsControls
              .flat()
              .concat(prevFlattenedFacetList);
            const prevMergedfacetValueIds = prevMerged.map((fV) => fV.id);
            component.updateProductDetailFormGroup(
              nextMergedfacetValueIds,
              prevMergedfacetValueIds
            );
            component.getConditionalShowOnProductDetailFacets(nextMerged);
          });
        this.cdr.detectChanges();
      });
  }

  createFormControlsForNewFacets(
    updatedFacetList: Facet[],
    detailFormValueIds: ID[]
  ): [FormControl<FacetValue[]>[], Facet[], ID[]] {
    const newControls: FormControl[] = [];
    const newFacets: Facet[] = [];
    const newFacetValueIds: ID[] = [];
    for (let potentiallyNewFacet of updatedFacetList) {
      const alreadyExists = this.conditionalShowOnProductDetailFacets.some(
        (f) => f.id === potentiallyNewFacet.id
      );
      if (
        !alreadyExists &&
        !this.showOnProductDetailFacets.some(
          (f) => f.id === potentiallyNewFacet.id
        )
      ) {
        const alreadySelectedFacetValues = potentiallyNewFacet.values.filter(
          (v) => detailFormValueIds.find((id) => v.id === id)
        );
        newFacetValueIds.push(
          ...(alreadySelectedFacetValues.map((fV) => fV.id) as ID[])
        );
        newControls.push(
          new FormControl<FacetValue[]>(alreadySelectedFacetValues)
        );
        newFacets.push(potentiallyNewFacet);
      }
    }
    return [newControls, newFacets, newFacetValueIds];
  }

  keepFormControlsForExistingFacets(
    updatedFacetList: Facet[]
  ): [FormControl<FacetValue[]>[], Facet[], ID[]] {
    const existingControls: FormControl[] = [];
    const existingFacets: Facet[] = [];
    const selectedFacetValueIds: ID[] = [];
    const conditionalShowOnProductDetailFacetsControls = this.formGroup.get(
      'conditionalShowOnProductDetailFacetsControls'
    ) as FormArray;
    for (
      let possiblyNotUpdatedFacetIndex = 0;
      possiblyNotUpdatedFacetIndex <
      this.conditionalShowOnProductDetailFacets.length;
      possiblyNotUpdatedFacetIndex++
    ) {
      const possiblyNotUpdatedFacet =
        this.conditionalShowOnProductDetailFacets[possiblyNotUpdatedFacetIndex];
      const alreadyExists = updatedFacetList.some(
        (f) => f.id === possiblyNotUpdatedFacet.id
      );
      if (alreadyExists) {
        existingFacets.push(possiblyNotUpdatedFacet);
        const existingFormControl =
          conditionalShowOnProductDetailFacetsControls.at(
            possiblyNotUpdatedFacetIndex
          );
        selectedFacetValueIds.push(
          ...(conditionalShowOnProductDetailFacetsControls.value.map(
            (fV) => fV.id
          ) as ID[])
        );
        existingControls.push(
          conditionalShowOnProductDetailFacetsControls.at(
            possiblyNotUpdatedFacetIndex
          ) as FormControl<FacetValue[]>
        );
      }
    }
    return [existingControls, existingFacets, selectedFacetValueIds];
  }
}
