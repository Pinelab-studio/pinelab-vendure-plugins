import { DashboardFormComponent, Input, useChannel } from '@vendure/dashboard';
import { ChannelAwareIntValue } from '../../types';

function idsAreEqual(id1?: string | number, id2?: string | number): boolean {
  if (id1 === undefined || id2 === undefined || !id1 || !id2) {
    return false;
  }
  return id1.toString() === id2.toString();
}

/**
 * Custom field input for a `list: true` text field that stores one
 * JSON-encoded { channelId, value } entry per channel. Only the entry for
 * the currently active channel is shown/edited; the rest of the list is
 * preserved untouched.
 */
export const ChannelAwareIntCustomField: DashboardFormComponent = (props) => {
  const { activeChannel } = useChannel();
  const activeChannelId = activeChannel?.id;

  const values: ChannelAwareIntValue[] = ((props.value as string[]) ?? []).map(
    (v) => JSON.parse(v) as ChannelAwareIntValue
  );
  const currentValue =
    values.find((v) => idsAreEqual(v.channelId as string, activeChannelId))
      ?.value ?? 0;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    let nextValues: ChannelAwareIntValue[];
    if (!newValue) {
      // Remove entry for this channel
      nextValues = values.filter(
        (v) => !idsAreEqual(v.channelId as string, activeChannelId)
      );
    } else {
      const existing = values.find((v) =>
        idsAreEqual(v.channelId as string, activeChannelId)
      );
      if (existing) {
        nextValues = values.map((v) =>
          idsAreEqual(v.channelId as string, activeChannelId)
            ? { ...v, value: newValue }
            : v
        );
      } else {
        nextValues = [
          ...values,
          { channelId: activeChannelId as string, value: newValue },
        ];
      }
    }
    props.onChange(nextValues.map((v) => JSON.stringify(v)));
  };

  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={currentValue}
      onChange={handleChange}
      onBlur={props.onBlur}
      name={props.name}
      disabled={props.disabled}
      ref={props.ref}
    />
  );
};

ChannelAwareIntCustomField.metadata = { isListInput: true };
