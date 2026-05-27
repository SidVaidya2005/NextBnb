export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${dim} animate-spin rounded-full border-2 border-hairline border-t-ink`}
    />
  );
}
