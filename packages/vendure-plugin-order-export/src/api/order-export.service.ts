import { Injectable, Inject } from '@nestjs/common';
import { OrderExportPluginConfig } from '../order-export.plugin';
import { PLUGIN_INIT_OPTIONS } from '../constants';

@Injectable()
export class OrderExportService {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private config: OrderExportPluginConfig
  ) {}
}
