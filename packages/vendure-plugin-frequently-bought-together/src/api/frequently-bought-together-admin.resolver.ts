import { Resolver } from '@nestjs/graphql';
import { FrequentlyBoughtTogetherService } from '../services/frequently-bought-together.service';

@Resolver()
export class FrequentlyBoughtTogetherAdminResolver {
  constructor(
    private frequentlyBoughtTogetherService: FrequentlyBoughtTogetherService
  ) {}
}
