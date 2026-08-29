import { Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ConcoursVisibilitySwitchProps {
  estPublic: boolean;
  disabled?: boolean;
  onChange: (estPublic: boolean) => void;
}

export function ConcoursVisibilitySwitch({ estPublic, disabled, onChange }: ConcoursVisibilitySwitchProps) {
  const Icon = estPublic ? Eye : EyeOff;
  const label = estPublic ? 'Public' : 'Privé';

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2 py-1"
      title={estPublic ? 'Visible par tous' : 'Visible uniquement par les administrateurs'}
    >
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-8 text-xs font-medium text-foreground/75">{label}</span>
      <Switch
        checked={estPublic}
        disabled={disabled}
        aria-label={`Rendre le concours ${estPublic ? 'privé' : 'public'}`}
        onCheckedChange={onChange}
      />
    </div>
  );
}
