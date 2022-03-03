import gql from 'graphql-tag';

export const getConfigs = gql`
  query orderExportConfigs {
    orderExportConfigs {
      name
      arguments {
        name
        value
      }
    }
  }
`;

export const getExports = gql`
  query orderExportResults($filter: OrderExportResultFilter!) {
    orderExportResults(filter: $filter) {
      totalItems
      items {
        id
        createdAt
        updatedAt
        orderPlacedAt
        orderId
        orderCode
        customerEmail
        reference
        message
        externalLink
        successful
      }
    }
  }
`;

export const saveConfig = gql`
  mutation updateOrderExportConfig($input: OrderExportConfigInput!) {
    updateOrderExportConfig(input: $input) {
      name
      arguments {
        name
        value
      }
    }
  }
`;

export const exportOrders = gql`
  mutation exportOrders($orderIds: [ID!]!) {
    exportOrders(orderIds: $orderIds)
  }
`;
