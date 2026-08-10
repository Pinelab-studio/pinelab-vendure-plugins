import { api, Badge, useFormContext } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, AlertTriangleIcon } from 'lucide-react';

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

  if (requiredFacets.length === 0) {
    return null;
  }

  const isComplete = requiredFacets.every((f) => f.selectedValues.length > 0);

  const toggleFacetValue = (valueId: string) => {
    const current: string[] = watch('facetValueIds') ?? [];
    const next = current.includes(valueId)
      ? current.filter((id) => id !== valueId)
      : [...current, valueId];
    setValue('facetValueIds', next, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Suggested facets</span>
        {isComplete ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2Icon className="h-3 w-3" />
            complete
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <AlertTriangleIcon className="h-3 w-3" />
            incomplete
          </Badge>
        )}
      </div>
      {requiredFacets.map(({ facet, selectedValues }) => (
        <div key={facet.id} className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground min-w-32">
            {facet.name}
          </span>
          {facet.values.map((value) => {
            const isSelected = selectedValues.some((v) => v.id === value.id);
            return (
              <Badge
                key={value.id}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => toggleFacetValue(value.id)}
              >
                {value.name}
              </Badge>
            );
          })}
        </div>
      ))}
    </div>
  );
}
