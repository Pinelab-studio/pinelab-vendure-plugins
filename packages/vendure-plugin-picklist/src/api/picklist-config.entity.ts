import { Column, Entity, ColumnType } from 'typeorm';
import { DeepPartial, Logger, VendureEntity } from '@vendure/core';
import { loggerCtx } from '../constants';

@Entity('picklist_config')
export class PicklistConfigEntity extends VendureEntity {
  constructor(input?: DeepPartial<PicklistConfigEntity>) {
    super(input);
  }

  @Column()
  channelId!: string;

  @Column({ default: false })
  enabled: boolean = false;

  @Column({ type: resolveTemplateColumnType(), nullable: true })
  templateString?: string | null;
}

/**
 * Resolve column type based on the DB engine
 */
function resolveTemplateColumnType(): ColumnType {
  const dbEngine = process.env.PICKLISTS_PLUGIN_DB_ENGINE;
  if (!dbEngine) {
    return 'text';
  } else if (dbEngine === 'mysql' || 'mariadb') {
    return 'longtext'; // up to 4GB
  } else if (dbEngine === 'postgres') {
    return 'text'; // Up to 1GB
  } else if (dbEngine === 'cockroachdb') {
    return 'string';
  } else if (dbEngine === 'mssql') {
    return 'text';
  } else if (dbEngine === 'sqlite') {
    return 'text';
  } else if (dbEngine === 'oracle') {
    return 'clob';
  } else {
    Logger.warn(
      `No large-text column type available for DB engine "${dbEngine}", using "text". ( Contributions welcome )`,
      loggerCtx
    );
  }
  return 'text';
}
