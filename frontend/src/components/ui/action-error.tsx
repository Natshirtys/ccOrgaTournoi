interface ActionErrorProps {
  error: unknown;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Une erreur inattendue s'est produite. Veuillez réessayer.";
}

export function ActionError({ error }: ActionErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {getErrorMessage(error)}
    </div>
  );
}
