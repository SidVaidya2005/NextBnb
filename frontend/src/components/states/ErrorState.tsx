import { Button } from '../common/Button';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong.', message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-md rounded-md border border-hairline bg-surface-soft px-lg py-xl text-center">
      <h3 className="t-display-md">{title}</h3>
      {message && <p className="t-body-md max-w-[480px] text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
