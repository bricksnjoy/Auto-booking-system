/**
 * Shown while a page's data is on its way. Every screen here is rendered on
 * demand against Supabase, so without this a click sits on the old page doing
 * nothing visible and reads as a broken button rather than a slow one.
 */
export function Bar({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-[var(--hover)] ${className}`} />;
}

export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6">
        <Bar className="h-7 w-52" />
        <Bar className="mt-2 h-4 w-72" />
      </div>

      {stats > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] px-5 py-4">
              <Bar className="h-3 w-24" />
              <Bar className="mt-3 h-6 w-28" />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <Bar className="h-4 w-36" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Bar className="h-4 flex-1" />
              <Bar className="h-4 w-24" />
              <Bar className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A form on its way: a title, fields, and a document beside them. */
export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6">
        <Bar className="h-7 w-52" />
        <Bar className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-[var(--border)] p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Bar className="h-3 w-24" />
              <Bar className="mt-2 h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--border)] p-5">
          <Bar className="h-[420px] w-full" />
        </div>
      </div>
    </div>
  );
}
