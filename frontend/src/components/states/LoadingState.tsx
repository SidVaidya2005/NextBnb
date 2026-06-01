import { Spinner } from "../common/Spinner";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md py-xxl text-ink-muted">
      <Spinner />
      <p className="t-caption">{label}</p>
    </div>
  );
}
