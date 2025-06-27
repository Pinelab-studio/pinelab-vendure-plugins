export interface KlaviyoProductFeedItem {
  id: string;
  title: string;
  /**
   * The full URL to the product.
   */
  link: string;
  description: string;
  price: number;
  /**
   * The full URL to the image.
   */
  image_link: string;
  categories: string[];
  inventory_quantity: number;
  inventory_policy: 1 | 2;
}
