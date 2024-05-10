import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ShipmateService } from './api/shipmate.service';
import { HttpModule } from '@nestjs/axios';

@VendurePlugin({
  imports: [PluginCommonModule, HttpModule],
  providers: [ShipmateService],
})
export class VendureShipmatePlugin {}
