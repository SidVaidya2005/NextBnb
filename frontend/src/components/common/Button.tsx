import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'pill-rausch';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-4 t-button-sm',
  md: 'h-12 px-6 t-button-md',
  lg: 'h-14 px-8 t-button-md',
};

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-rausch text-ink-on-primary border border-rausch hover:bg-rausch-active hover:border-rausch-active active:bg-rausch-active disabled:bg-rausch-disabled disabled:border-rausch-disabled disabled:cursor-not-allowed',
  secondary:
    'bg-surface-canvas text-ink border border-ink hover:bg-surface-soft disabled:text-ink-muted-soft disabled:border-hairline disabled:cursor-not-allowed',
  tertiary:
    'bg-transparent text-ink border-0 underline-offset-2 hover:underline disabled:text-ink-muted-soft',
  'pill-rausch':
    'bg-rausch text-ink-on-primary border-0 px-5 py-2.5 t-button-sm hover:bg-rausch-active',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const isPill = variant === 'pill-rausch';
  const shape = isPill ? 'rounded-full' : `rounded-sm ${sizeStyles[size]}`;
  return (
    <button
      className={`press inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans cursor-pointer ${shape} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
