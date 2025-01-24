import { Column, Entity, ColumnType } from 'typeorm';
import { DeepPartial, Logger, VendureEntity } from '@vendure/core';
import { loggerCtx } from '../constants';

@Entity('pdf_template')
export class PDFTemplateEntity extends VendureEntity {
  constructor(input?: DeepPartial<PDFTemplateEntity>) {
    super(input);
  }

  @Column()
  channelId!: string;

  @Column()
  name!: string;

  @Column({ default: true })
  enabled: boolean = true;

  @Column({ default: false })
  public: boolean = false;

  @Column({ type: resolveTemplateColumnType(), nullable: false })
  templateString!: string;
}

/**
 * Resolve column type based on the DB engine
 */
function resolveTemplateColumnType(): ColumnType {
  const dbEngine = process.env.PDF_TEMPLATE_PLUGIN_DB_ENGINE;
  if (!dbEngine) {
    return 'text';
  } else if (dbEngine === 'mysql' || dbEngine === 'mariadb') {
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
