import {
  api,
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  MultiSelect,
  useFormContext,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const getRequiredFacetsDocument = graphql(`
  query GetRequiredFacets {
    requiredFacets {
      id
      name
      customFields {
        showOnProductDetail
        showOnProductDetailIf {
          id
        }
      }
      values {
        id
        name
        facet {
          id
          name
        }
      }
    }
  }
`);

/**
 * Suggests facets to fill in on the product detail page, based on facets
 * marked `showOnProductDetail` or `showOnProductDetailIf` in the Facet's
 * custom fields. Lets the admin add/remove facet values directly on the
 * in-progress product edit form.
 */
export function SuggestedFacetsBlock() {
  const { watch, setValue } = useFormContext();
  const selectedFacetValueIds: string[] = watch('facetValueIds') ?? [];

  const { data } = useQuery({
    queryKey: ['required-facets'],
    queryFn: () => api.query(getRequiredFacetsDocument, {}),
    staleTime: 60_000,
  });

  const possiblyRequiredFacets = (data?.requiredFacets ?? []).filter(
    (facet) =>
      facet.customFields?.showOnProductDetail === true ||
      (facet.customFields?.showOnProductDetailIf?.length ?? 0) > 0
  );

  const requiredFacets = possiblyRequiredFacets
    .filter(
      (facet) =>
        facet.customFields?.showOnProductDetail === true ||
        facet.customFields?.showOnProductDetailIf?.some((f) =>
          selectedFacetValueIds.includes(f.id)
        )
    )
    .map((facet) => ({
      facet,
      selectedValues: facet.values.filter((v) =>
        selectedFacetValueIds.includes(v.id)
      ),
    }));

  const isComplete = requiredFacets.every((f) => f.selectedValues.length > 0);
  const [isOpen, setIsOpen] = useState(!isComplete);

  useEffect(() => {
    setIsOpen(!isComplete);
  }, [isComplete]);

  if (requiredFacets.length === 0) {
    return null;
  }

  /** Replaces the selected values for one facet without changing other facets. */
  const setSelectedFacetValues = (
    facetValueIds: string[],
    selectedValueIds: string[]
  ) => {
    const current: string[] = watch('facetValueIds') ?? [];
    const facetValueIdSet = new Set(facetValueIds);
    const next = [
      ...current.filter((id) => !facetValueIdSet.has(id)),
      ...selectedValueIds,
    ];
    setValue('facetValueIds', next, { shouldDirty: true });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <span className="flex items-center gap-2 font-semibold">
          <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
          Suggested facets
        </span>
        {isComplete ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2Icon className="h-3 w-3" />
            complete
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <AlertTriangleIcon className="h-3 w-3" />
            incomplete
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="space-y-3">
          {requiredFacets.map(({ facet, selectedValues }) => (
            <div
              key={facet.id}
              className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center"
            >
              <span className="text-sm font-medium">{facet.name}</span>
              <MultiSelect
                multiple
                value={selectedValues.map((value) => value.id)}
                onChange={(valueIds) =>
                  setSelectedFacetValues(
                    facet.values.map((value) => value.id),
                    valueIds
                  )
                }
                items={facet.values.map((value) => ({
                  value: value.id,
                  label: value.name,
                }))}
                placeholder="Select facet values"
                className="w-full"
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
