import { Button, CustomFormComponent } from '@vendure/dashboard';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { ComponentProps } from 'react';

type RelationListInputProps = ComponentProps<typeof CustomFormComponent>;

/** Keeps relation order editable while reusing Vendure's entity-specific single picker. */
export function RelationListInput({
  value,
  onChange,
  fieldDef,
  ...props
}: RelationListInputProps) {
  const items: unknown[] = Array.isArray(value) ? value : [];

  function move(index: number, offset: number) {
    const reordered = [...items];
    [reordered[index], reordered[index + offset]] = [
      reordered[index + offset],
      reordered[index],
    ];
    onChange(reordered);
  }

  return (
    <fieldset aria-label={fieldDef.name} className="space-y-2">
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <CustomFormComponent
                {...props}
                fieldDef={{ ...fieldDef, list: false }}
                value={item}
                onChange={(selected) => {
                  const updated = [...items];
                  updated[index] = selected;
                  onChange(updated);
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move item ${index + 1} up`}
              disabled={props.disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move item ${index + 1} down`}
              disabled={props.disabled || index === items.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove item ${index + 1}`}
              disabled={props.disabled}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled || items.includes(null)}
        onClick={() => onChange([...items, null])}
      >
        <Plus className="size-4" /> Add {fieldDef.name}
      </Button>
    </fieldset>
  );
}
