import { gql } from 'graphql-tag';

const scalars = gql`
  scalar JSON
`;

export const shopApiExtension = gql`
  enum KlaviyoReviewStatus {
    featured
    pending
    published
    rejected
    unpublished
  }

  type KlaviyoProduct {
    url: String
    name: String
    image_url: String
  }

  type KlaviyoPublicReply {
    content: String
    author: String
    updated: String
  }

  type KlaviyoReviewAttributes {
    email: String
    status: KlaviyoReviewStatus
    verified: Boolean
    review_type: String
    created: String
    updated: String
    images: [String]
    product: KlaviyoProduct
    rating: Int
    author: String
    content: String
    title: String
    smart_quote: String
    public_reply: KlaviyoPublicReply
  }

  type KlaviyoReview {
    type: String
    id: ID
    attributes: KlaviyoReviewAttributes
    links: KlaviyoLinks
    relationships: KlaviyoReviewRelationships
  }

  type KlaviyoLinks {
    self: String
    first: String
    last: String
    prev: String
    next: String
  }

  type KlaviyoReviewRelationships {
    events: KlaviyoEventRelationship
    item: KlaviyoItemRelationship
  }

  type KlaviyoEventRelationship {
    data: [KlaviyoDataEvent]
    links: KlaviyoEventLinks
  }

  type KlaviyoDataEvent {
    type: String
    id: String
  }

  type KlaviyoEventLinks {
    self: String
    related: String
  }

  type KlaviyoItemRelationship {
    links: KlaviyoItemLinks
  }

  type KlaviyoItemLinks {
    self: String
    related: String
  }

  type KlaviyoEvent {
    type: String
    id: ID
    attributes: KlaviyoEventAttributes
    links: KlaviyoEventLinks
  }

  type KlaviyoEventAttributes {
    timestamp: Int
    event_properties: JSON
    datetime: String
    uuid: String
  }

  type KlaviyoResponse {
    data: [KlaviyoReview]!
    links: KlaviyoLinks!
    included: [KlaviyoEvent]!
  }

  extend type Query {
    getKlaviyoReviews: KlaviyoResponse
  }
`;
