/** Shimmering skeleton block for loading states. */
export function Skeleton({
  className = "",
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div aria-hidden="true" className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mb-2 h-4 animate-pulse rounded bg-slate-200 last:mb-0 dark:bg-slate-700"
        />
      ))}
    </div>
  );
}

/** Skeleton rows for a table/card list. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
