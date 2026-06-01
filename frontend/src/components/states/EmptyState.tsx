import type { ReactNode } from "react";

interface Props {
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-md rounded-md border border-hairline bg-surface-soft px-lg py-xxl text-center">
      <h3 className="t-display-md">{title}</h3>
      {body && <p className="t-body-md max-w-[480px] text-ink-muted">{body}</p>}
      {action && <div className="mt-sm">{action}</div>}
    </div>
  );
}
