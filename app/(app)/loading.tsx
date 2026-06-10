// Shown instantly on navigation to any app page while its server component
// fetches data — makes transitions feel immediate instead of blank.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[420px] animate-pulse px-6 pb-20 pt-8">
      <div className="mb-10 flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>

      <div className="h-7 w-56 rounded bg-muted" />

      <div className="divider my-7" />

      <div className="h-3 w-16 rounded bg-muted" />
      <div className="mt-3 h-10 w-40 rounded bg-muted" />
      <div className="mt-4 h-1 w-full rounded-full bg-muted" />

      <div className="divider my-7" />

      <div className="flex justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-6 w-10 rounded bg-muted" />
            <div className="h-2 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="divider my-7" />

      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-4 flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
    </main>
  )
}
