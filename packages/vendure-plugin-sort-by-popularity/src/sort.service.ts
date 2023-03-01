import { Injectable } from '@nestjs/common';

@Injectable()
export class SortService {
  async setProductPopularity() {
    // Get orders from pas X months
    // Combine variant quantities per product
    // Normalize by total quantity and store as popularity score on product
    // Get all products and products of child collections for each collection
    // Use sum of products per collection as popularity score
  }
}
