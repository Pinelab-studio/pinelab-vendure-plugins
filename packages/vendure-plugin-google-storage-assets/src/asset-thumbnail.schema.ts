import gql from "graphql-tag";

export const assetThumbnailSchema = gql`
  extend type Asset {
    thumbnail: String!
  }
`;
