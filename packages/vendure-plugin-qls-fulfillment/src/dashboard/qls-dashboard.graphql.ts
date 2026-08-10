import { graphql } from '@/gql';

export const orderQlsUrlDocument = graphql(`
  query OrderQlsUrl($id: ID!) {
    order(id: $id) {
      id
      qlsOrderUrl
    }
  }
`);

export const orderQlsIdsDocument = graphql(`
  query OrderQlsIds($id: ID!) {
    order(id: $id) {
      id
      qlsOrderIds
    }
  }
`);

export const productVariantQlsUrlDocument = graphql(`
  query ProductVariantQlsUrl($id: ID!) {
    productVariant(id: $id) {
      id
      qlsProductUrl
    }
  }
`);

export const triggerQlsProductSyncDocument = graphql(`
  mutation TriggerQlsProductSync {
    triggerQlsProductSync
  }
`);

export const pushOrderToQlsDocument = graphql(`
  mutation PushOrderToQls($orderId: ID!) {
    pushOrderToQls(orderId: $orderId)
  }
`);

export const addAdditionalEanToQlsDocument = graphql(`
  mutation AddAdditionalEanToQls($variantId: ID!, $additionalEANS: [String!]!) {
    addAdditionalEANSToQLS(
      variantId: $variantId
      additionalEANS: $additionalEANS
    )
  }
`);
