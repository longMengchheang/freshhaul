export default function RootLoading() {
  return (
    <div className="page-shell space-y-6">
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200/80" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-xl bg-slate-200/80" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-slate-200/60 bg-white" />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="h-72 animate-pulse rounded-xl border border-slate-200/60 bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200/60 bg-white" />
      </div>
    </div>
  );
}
