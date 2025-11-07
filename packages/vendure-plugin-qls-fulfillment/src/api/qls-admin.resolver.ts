import { Resolver } from '@nestjs/graphql';
import { QlsService } from '../services/qls.service';

@Resolver()
export class QlsAdminResolver {
  constructor(private qlsService: QlsService) {}
}
