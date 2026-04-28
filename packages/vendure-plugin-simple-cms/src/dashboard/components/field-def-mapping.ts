/**
 * Maps a SimpleCmsField (admin-API DTO) to a `ConfigurableFieldDef`-compatible
 * shape consumable by Vendure's `CustomFormComponent` /
 * `DefaultInputForType`. The mapping:
 *
 *  - 'date'    => 'datetime' (Vendure's input switch uses 'datetime')
 *  - 'text'    => keeps 'string' but injects ui.component
 *                 'textarea-form-input' if no component is set, so the
 *                 registered TextareaInput is rendered
 *  - 'relation' => sets `entity = graphQLType`
 *  - all others pass through
 *
 * Any user-set `ui` config (component + arbitrary props) is preserved
 * verbatim so configured custom inputs continue to work.
 */
export interface SimpleCmsFieldDto {
  name: string;
  type: string;
  nullable: boolean;
  isTranslatable?: boolean | null;
  graphQLType?: string | null;
  fields?: SimpleCmsFieldDto[] | null;
  ui?: Record<string, unknown> | null;
}

export interface MappedFieldDef {
  name: string;
  label: string;
  description: string | null;
  list: boolean;
  required: boolean;
  type: string;
  defaultValue: unknown;
  ui: Record<string, unknown> | null;
  entity?: string;
  /**
   * Marks the field as a "custom field config" for Vendure's form engine.
   * `DefaultRelationInput` only renders for fields recognized as a relation
   * custom field config, which is detected by `hasOwnProperty('readonly')`.
   * We always emit a non-readonly value here.
   */
  readonly?: boolean;
}

/**
 * Convert a SimpleCmsField definition into a fieldDef object accepted by
 * Vendure's form-engine helpers.
 */
export function mapSimpleCmsFieldToFieldDef(
  f: SimpleCmsFieldDto
): MappedFieldDef {
  const required = !f.nullable;
  let type = f.type;
  let ui: Record<string, unknown> | null = f.ui ? { ...f.ui } : null;

  if (type === 'date') {
    type = 'datetime';
  }

  if (f.type === 'text' && (!ui || !ui.component)) {
    ui = { ...(ui ?? {}), component: 'textarea-form-input' };
    type = 'string';
  }

  const fieldDef: MappedFieldDef = {
    name: f.name,
    label: f.name,
    description: null,
    list: false,
    required,
    type,
    defaultValue: null,
    ui,
  };

  if (f.type === 'relation' && f.graphQLType) {
    fieldDef.entity = f.graphQLType;
    // Required so Vendure's `DefaultRelationInput` recognizes the field
    // as a relation custom field config and renders the entity-specific
    // selector (e.g. AssetPicker style for `Asset`).
    fieldDef.readonly = false;
  }

  return fieldDef;
}
