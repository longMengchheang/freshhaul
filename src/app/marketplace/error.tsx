'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Marketplace error boundary:', error);
  }, [error]);

  return (
    <main className="page-shell !max-w-[900px] py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Marketplace temporarily unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">We could not load this market view.</h1>
        <p className="mt-3 text-sm text-slate-600">Please retry now. If the issue continues, return to the main market screen.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Retry
          </button>
          <Link href="/marketplace" className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Go to marketplace home
          </Link>
        </div>
      </section>
    </main>
  );
}

