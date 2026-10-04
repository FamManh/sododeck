import { Switch } from '@sododeck/ui/components/switch';

/** An export option: a switch with its label (the dialog uses switches for every option). */
export function OptionSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-body-sm text-ink">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
