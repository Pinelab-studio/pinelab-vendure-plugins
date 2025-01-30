import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { DROP_OFF_POINTS_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions } from '../types';

@Injectable()
export class DropOffPointsService {
  constructor(
    private connection: TransactionalConnection,
    @Inject(DROP_OFF_POINTS_PLUGIN_OPTIONS) private options: PluginInitOptions
  ) {}

  // TODO: Call drop-off points on selected strategy
  // Encode the selected
}
