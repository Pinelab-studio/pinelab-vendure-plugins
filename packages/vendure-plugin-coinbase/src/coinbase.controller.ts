import { Controller } from '@nestjs/common';
import { Resolver } from '@nestjs/graphql';

@Controller('coinbase')
export class CoinbaseController {}

@Resolver()
export class CoinbaseResolver {}
