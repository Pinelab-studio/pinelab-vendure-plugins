import { CustomFormComponent, FormFieldWrapper } from '@vendure/dashboard';
import { Control } from 'react-hook-form';
import {
  mapSimpleCmsFieldToFieldDef,
  SimpleCmsFieldDto,
  SimpleCmsStructSubFieldDto,
} from './field-def-mapping';

interface RenderFieldProps {
  field: SimpleCmsFieldDto | SimpleCmsStructSubFieldDto;
  /**
   * Full dotted path to the field in the react-hook-form values.
   * For non-translatable: 'fields.<name>'; for active-language translatable:
   * 'translations.<lang>.<name>'.
   */
  name: string;
  control: Control<any>;
}

/**
 * Recursively renders a single SimpleCms field.
 *
 * - Primitive/relation fields are rendered through Vendure's
 *   `CustomFormComponent`, which resolves the `ui.component` registered
 *   id, falling back to `DefaultInputForType` based on `fieldDef.type`.
 * - Struct fields render a labeled fieldset and recurse over their
 *   sub-fields.
 */
export function RenderField({ field, name, control }: RenderFieldProps) {
  const asTopLevel = field as SimpleCmsFieldDto;
  if (asTopLevel.type === 'struct' && asTopLevel.fields?.length) {
    return (
      <fieldset className="border rounded p-4 space-y-4">
        <legend className="px-2 text-sm font-medium">{field.name}</legend>
        {asTopLevel.fields.map((sub) => (
          <RenderField
            key={sub.name}
            field={sub}
            name={`${name}.${sub.name}`}
            control={control}
          />
        ))}
      </fieldset>
    );
  }

  const fieldDef = mapSimpleCmsFieldToFieldDef(field);

  return (
    <FormFieldWrapper
      control={control}
      name={name}
      label={field.name}
      render={({ field: rhfField }) => (
        <CustomFormComponent {...rhfField} fieldDef={fieldDef as any} />
      )}
    />
  );
}
