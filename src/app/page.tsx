import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Route,
  ShieldCheck,
  ShoppingBasket,
  Snowflake,
  Sprout,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';

export default async function Home() {
  const context = await getCurrentUserContext();
  if (context) {
    redirect(context.systemRole === 'admin' ? '/admin' : '/dashboard');
  }

  const authUser = await getCurrentAuthUser();
  if (authUser) {
    redirect('/auth/complete-profile');
  }

  const modules = [
    {
      href: '/auth/register',
      label: 'Create buyer account',
      detail: 'Get immediate marketplace access and secure produce from verified sellers.',
      icon: ShoppingBasket,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
    },
    {
      href: '/auth/register',
      label: 'Apply as farmer',
      detail: 'Publish available harvest, negotiate offers, and move inventory faster.',
      icon: Sprout,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      href: '/auth/register',
      label: 'Apply as driver',
      detail: 'Find matched cold-chain trips and coordinate delivery in one workspace.',
      icon: Truck,
      tone: 'text-sky-700 bg-sky-50 border-sky-100',
    },
  ] as const;

  const highlights = [
    {
      icon: Snowflake,
      title: 'Cold-chain visibility',
      text: 'Track shipment status and handoffs so produce quality stays predictable from farm to buyer.',
    },
    {
      icon: Route,
      title: 'Faster dispatch loops',
      text: 'Operational views for marketplace matching, route coordination, and cleaner day-of-delivery execution.',
    },
    {
      icon: ShieldCheck,
      title: 'Reliable execution',
      text: 'Role-based workflows, clear state transitions, and payment-ready summaries reduce friction at each step.',
    },
  ] as const;

  const trustItems = [
    'Role-aware dashboard for buyers, farmers, drivers, and admins',
    'Unified deal lifecycle from listing to settlement',
    'Simple onboarding with mobile-ready navigation',
  ] as const;

  return (
    <div className="page-shell space-y-16 pb-16 sm:space-y-20">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20" style={{ boxShadow: 'var(--shadow-xl)' }}>
        <div className="hero-orb -left-24 -top-16 h-56 w-56 bg-emerald-400/40" />
        <div className="hero-orb -right-28 top-[10%] h-64 w-64 bg-amber-400/30 [animation-delay:1.1s]" />
        <div className="hero-orb -bottom-32 left-[40%] h-60 w-60 bg-sky-300/25 [animation-delay:2.1s]" />
        <div className="lux-grid pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="reveal-up flex justify-center">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Fresh produce marketplace platform
            </Badge>
          </div>

          <h1 className="display-title reveal-up reveal-delay-1 mx-auto mt-6 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.12]">
            From harvest to delivery, orchestrated with confidence.
          </h1>

          <p className="reveal-up reveal-delay-2 mx-auto mt-6 max-w-2xl text-[1.06rem] leading-relaxed text-slate-500 sm:text-lg">
            FreshHaul gives farmers, buyers, and refrigerated drivers one clean operational layer to list produce,
            align on pricing, and execute transport with fewer calls and better visibility.
          </p>

          <div className="reveal-up reveal-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-7 text-[0.9rem] font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-[0_6px_12px_-2px_rgba(50,50,93,0.2)] active:scale-[0.98]"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              Start with FreshHaul
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-7 text-[0.9rem] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_2px_5px_rgba(50,50,93,0.08)] active:scale-[0.98]"
              style={{ boxShadow: 'var(--shadow-xs)' }}
            >
              Sign in
            </Link>
          </div>

          <div className="reveal-up reveal-delay-3 mx-auto mt-12 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { label: 'Unified lifecycle', value: 'Listing → Deal → Dispatch' },
              { label: 'Multi-role support', value: 'Buyer / Farmer / Driver' },
              { label: 'Mobile-first ops', value: 'Fast and touch-friendly' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200/60 bg-white/80 px-4 py-3 text-center backdrop-blur-sm" style={{ boxShadow: 'var(--shadow-xs)' }}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform coverage ───────────────────────────────── */}
      <section className="reveal-up space-y-8">
        <div className="text-center">
          <h2 className="display-title text-2xl font-bold text-slate-950 sm:text-3xl">What the platform covers</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Everything you need to move fresh produce from farm to buyer with operational clarity.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              className={`premium-card reveal-up p-6 ${i === 1 ? 'reveal-delay-1' : i === 2 ? 'reveal-delay-2' : ''}`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[0.95rem] font-semibold text-slate-900">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Role selection ──────────────────────────────────── */}
      <section className="reveal-up space-y-8">
        <div className="text-center">
          <h2 className="display-title text-2xl font-bold text-slate-950 sm:text-3xl">Choose your starting path</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Every role gets a tailored workspace, while staying connected in one shared operational flow.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {modules.map(({ href, label, detail, icon: Icon, tone }) => (
            <Link
              key={label}
              href={href}
              className="premium-card group rounded-xl p-6"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-950">{label}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{detail}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-transform duration-200 group-hover:translate-x-1">
                Continue
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trust / Why FreshHaul ────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="premium-card reveal-up p-6 sm:p-8">
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            Why teams choose FreshHaul
          </Badge>
          <h3 className="display-title mt-5 text-2xl font-bold text-slate-950 sm:text-[1.75rem]">
            Operational simplicity without sacrificing control.
          </h3>
          <p className="mt-4 text-slate-500 leading-relaxed">
            Remove spreadsheet drift, disconnected chats, and fragmented dispatch calls. Keep every participant aligned
            in one process from posting inventory to payment-ready handoff.
          </p>
          <div className="mt-6 space-y-3">
            {trustItems.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-relaxed text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Compass,
              title: 'Intuitive by design',
              text: 'Clear information architecture that reduces decision fatigue and user error.',
            },
            {
              icon: BarChart3,
              title: 'Actionable visibility',
              text: 'Surface only what matters next so teams can execute quickly under real-world pressure.',
            },
            {
              icon: Route,
              title: 'Dispatch-ready workflows',
              text: 'Purpose-built transitions for booking, handoff, and trip completion.',
            },
            {
              icon: ShieldCheck,
              title: 'Trust at each touchpoint',
              text: 'Safe role boundaries and sensible defaults keep operations smooth as volume grows.',
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <div
              key={title}
              className={`premium-card reveal-up p-5 ${index > 1 ? 'reveal-delay-2' : 'reveal-delay-1'}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[0.95rem] font-semibold text-slate-900">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────── */}
      <section className="reveal-up text-center">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/60 bg-slate-50/80 px-8 py-10" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="display-title text-xl font-bold text-slate-950 sm:text-2xl">Ready to get started?</h3>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            Create your account in under a minute and start managing your fresh produce operations today.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.98]"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
              style={{ boxShadow: 'var(--shadow-xs)' }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
