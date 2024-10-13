import {
  KlaviyoResponse,
  KlaviyoReviewStatus,
} from '../src/ui/generated/graphql';

export const klaviyoReviews: KlaviyoResponse = {
  data: [
    {
      type: 'review',
      id: '925e385b52fb405715f3616c337cc65c',
      attributes: {
        email: 'john@doe.com',
        status: KlaviyoReviewStatus.Featured,
        verified: true,
        review_type: 'review',
        created: '2022-11-08T00:00:00+00:00',
        updated: '2022-11-08T00:00:00+00:00',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
        product: {
          url: 'https://example.com/product/123',
          name: 'Product A',
          image_url: 'https://example.com/image.jpg',
        },
        rating: 2,
        author: 'John D',
        content: 'Great product! I love the smell. I will be buying again.',
        title: 'Smells great, would recommend',
        smart_quote: 'I love the smell',
        public_reply: {
          content: 'Thanks for the review!',
          author: 'Company X',
          updated: '2022-11-08T00:00:00+00:00',
        },
      },
      links: {
        self: 'string',
      },
      relationships: {
        events: {
          data: [
            {
              type: 'event',
              id: 'string',
            },
          ],
          links: {
            self: 'string',
            related: 'string',
          },
        },
        item: {
          links: {
            self: 'string',
            related: 'string',
          },
        },
      },
    },
    {
      type: 'review',
      id: '123e4567-e89b-12d3-a456-426614174000',
      attributes: {
        email: 'jane@doe.com',
        status: KlaviyoReviewStatus.Pending,
        verified: false,
        review_type: 'review',
        created: '2022-11-09T00:00:00+00:00',
        updated: '2022-11-09T00:00:00+00:00',
        images: ['https://example.com/image3.jpg'],
        product: {
          url: 'https://example.com/product/456',
          name: 'Product B',
          image_url: 'https://example.com/image.jpg',
        },
        rating: 4,
        author: 'Jane D',
        content: 'Nice product, but the delivery was late.',
        title: 'Good, but delivery issues',
        smart_quote: 'Delivery was late',
        public_reply: null,
      },
      links: {
        self: 'string',
      },
      relationships: {
        events: {
          data: [],
          links: {
            self: 'string',
            related: 'string',
          },
        },
        item: {
          links: {
            self: 'string',
            related: 'string',
          },
        },
      },
    },
    {
      type: 'review',
      id: '789e4567-e89b-12d3-a456-426614174001',
      attributes: {
        email: 'alice@doe.com',
        status: KlaviyoReviewStatus.Published,
        verified: true,
        review_type: 'review',
        created: '2022-11-10T00:00:00+00:00',
        updated: '2022-11-10T00:00:00+00:00',
        images: ['https://example.com/image4.jpg'],
        product: {
          url: 'https://example.com/product/789',
          name: 'Product C',
          image_url: 'https://example.com/image.jpg',
        },
        rating: 5,
        author: 'Alice W',
        content: 'Absolutely love this product! Highly recommend.',
        title: "Best purchase I've made!",
        smart_quote: 'Highly recommend',
        public_reply: {
          content: 'We appreciate your feedback!',
          author: 'Company Y',
          updated: '2022-11-10T00:00:00+00:00',
        },
      },
      links: {
        self: 'string',
      },
      relationships: {
        events: {
          data: [
            {
              type: 'event',
              id: 'string',
            },
          ],
          links: {
            self: 'string',
            related: 'string',
          },
        },
        item: {
          links: {
            self: 'string',
            related: 'string',
          },
        },
      },
    },
  ],
  links: {
    self: 'string',
    first: 'string',
    last: 'string',
    prev: 'string',
    next: 'string',
  },
  included: [
    {
      type: 'event',
      id: 'string',
      attributes: {
        timestamp: 0,
        event_properties: {},
        datetime: '2022-11-08T01:23:45+00:00',
        uuid: 'string',
      },
      links: {
        self: 'string',
      },
    },
  ],
};
