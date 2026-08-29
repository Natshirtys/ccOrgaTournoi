interface ActionErrorProps {
  error: unknown;
  compact?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Une erreur inattendue s'est produite. Veuillez réessayer.";
}

export function ActionError({ error, compact = false }: ActionErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={compact
        ? 'max-w-60 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs leading-tight text-destructive'
        : 'rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'}
    >
      {getErrorMessage(error)}
    </div>
  );
}
