import { graphql } from '@/vdb/graphql/graphql.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Wallet } from '../../api/generated/graphql';

export const GET_WALLET_WITH_ADJUSTMENTS = graphql(`
  query GetWalletWithAdjustments(
    $id: ID!
    $options: WalletAdjustmentListOptions
  ) {
    wallet(id: $id) {
      id
      adjustmentList(options: $options) {
        items {
          id
          createdAt
          amount
          description
          mutatedBy {
            id
            identifier
          }
        }
        totalItems
      }
    }
  }
`);

export function useWalletAdjustmentList({
  walletId,
  pageSize = 10,
}: {
  walletId: string | number;
  pageSize?: number;
}) {
  const {
    data,
    isLoading: isLoadingQuery,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryFn: ({ pageParam = 0 }) =>
      api.query(GET_WALLET_WITH_ADJUSTMENTS, {
        id: walletId.toString(),
        options: {
          sort: { createdAt: 'DESC' },
          skip: pageParam * pageSize,
          take: pageSize,
        } as any,
      }),
    queryKey: ['wallet', walletId],
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const totalItems =
        (lastPage.wallet as Wallet)?.adjustmentList?.totalItems ?? 0;
      const currentMaxItem = (lastPageParam + 1) * pageSize;
      const nextPage = lastPageParam + 1;
      return currentMaxItem < totalItems ? nextPage : undefined;
    },
  });

  const adjustments =
    data?.pages
      .flatMap((page) => (page.wallet as Wallet)?.adjustmentList?.items)
      .filter((x) => x != null) ?? [];

  return {
    adjustments,
    loading: isLoadingQuery,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  };
}
