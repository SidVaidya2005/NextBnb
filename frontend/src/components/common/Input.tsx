import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = '', ...rest }: Props) {
  return (
    <div className="flex flex-col gap-xs">
      {label && (
        <label htmlFor={id} className="t-caption text-ink-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`bg-surface-canvas border border-hairline rounded-sm h-14 px-md t-body-md text-ink placeholder:text-ink-muted-soft focus:outline-none focus:border-ink focus:border-2 focus:px-[11px] ${className}`}
        {...rest}
      />
    </div>
  );
}
