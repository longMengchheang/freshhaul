'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Handshake, LayoutDashboard, LogOut, Menu, PackagePlus, Route, Search, ShieldCheck, Truck, UserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Navbar() {
  const { session, profile, systemRole, activeRoles, roleStates, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const displayName = profile?.name ?? session?.user.user_metadata.name ?? session?.user.email ?? 'FreshHaul user';
  const isAuthenticated = Boolean(session);
  const isAdmin = systemRole === 'admin';
  const isSessionReady = isAuthenticated && !loading;
  const showGuestActions = !loading && !isAuthenticated;
  const hasFarmerAccess = activeRoles.includes('farmer');
  const hasDriverAccess = activeRoles.includes('driver');
  const activeRoleSummary = activeRoles.length > 0
    ? activeRoles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)).join(' / ')
    : 'Basic account';

  const links = isSessionReady
    ? isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]
      : [
          { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
          { href: '/marketplace', label: 'Market', icon: Search },
          { href: '/orders', label: 'Command', icon: Handshake },
          { href: '/deals', label: 'Deals', icon: Handshake },
          ...(hasFarmerAccess ? [{ href: '/post-shipment', label: 'Sell', icon: PackagePlus }] : []),
          ...(hasDriverAccess ? [{ href: '/browse-trips', label: 'Driver jobs', icon: Route }] : []),
        ]
    : [];

  const profileHref = isAdmin ? '/admin' : '/profile';
  const activeCapabilityCount = !isAdmin
    ? (['buyer', 'farmer', 'driver'] as const).filter((roleName) => roleStates[roleName] === 'active').length
    : 0;
  const profileMeta = isAdmin
    ? 'Admin'
    : profile?.province ?? `${activeCapabilityCount} active roles`;

  useEffect(() => {
    if (!isSessionReady) {
      return;
    }

    const prefetchTargets = new Set<string>(
      isAdmin
        ? ['/admin', profileHref]
        : [
            '/dashboard',
            '/marketplace',
            '/orders',
            '/deals',
            ...(hasFarmerAccess ? ['/post-shipment'] : []),
            ...(hasDriverAccess ? ['/browse-trips'] : []),
            profileHref,
          ],
    );
    for (const target of prefetchTargets) {
      router.prefetch(target);
    }
  }, [isSessionReady, isAdmin, hasFarmerAccess, hasDriverAccess, profileHref, router]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollYRef.current;
        const isScrollingDown = delta > 0;
        const absDelta = Math.abs(delta);
        const TOP_LOCK_Y = 80;
        const DIRECTION_THRESHOLD = 12;

        if (currentY <= TOP_LOCK_Y) {
          setIsVisible(true);
        } else if (isScrollingDown && absDelta >= DIRECTION_THRESHOLD && isVisibleRef.current) {
          setIsVisible(false);
        } else if (!isScrollingDown && absDelta >= DIRECTION_THRESHOLD && !isVisibleRef.current) {
          setIsVisible(true);
        }

        lastScrollYRef.current = currentY;
        tickingRef.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 pt-4 transition-all duration-300 ease-out will-change-transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-[120%] opacity-0'
      }`}
    >
      <nav className="glass-header flex items-center justify-between rounded-xl px-4 py-2.5 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Truck className="h-4 w-4" />
          </div>
          <p className="display-title truncate text-lg font-bold tracking-tight text-slate-950">FreshHaul</p>
        </Link>

        <div className="hidden items-center gap-1.5 lg:flex">
          {isSessionReady && (
            <div className="mr-1 flex h-10 items-center gap-0.5 rounded-lg border border-slate-200/60 bg-slate-50/80 p-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[0.82rem] font-semibold transition-all duration-150 ${
                    pathname === href
                      ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(50,50,93,0.08)]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}
          {isSessionReady ? (
              <div className="group relative">
                <Link href={profileHref} className="inline-flex h-10 min-w-36 items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 transition-all duration-150 hover:border-slate-300 hover:shadow-[0_2px_5px_rgba(50,50,93,0.08)]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
                    {profile?.avatar_url ? (
                      <Image src={profile.avatar_url} alt="" width={28} height={28} className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="max-w-28 truncate text-[0.8rem] font-semibold text-slate-900">{displayName}</p>
                    <p className="truncate text-[0.68rem] text-slate-400">{profileMeta}</p>
                  </div>
                </Link>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut(); }} className="invisible absolute right-2 top-1/2 -translate-y-1/2 z-50 flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-400 opacity-0 transition-all duration-150 hover:bg-red-50 hover:text-red-500 group-hover:visible group-hover:opacity-100" aria-label="Logout">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
          ) : loading ? (
            <div className="h-10 w-36 animate-pulse rounded-lg border border-slate-200/60 bg-slate-100" />
          ) : showGuestActions ? (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
                Sign in
              </Link>
              <Link href="/auth/register" className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-slate-800" style={{ boxShadow: 'var(--shadow-sm)' }}>
                Get started
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {loading ? (
            <span className="inline-flex h-9 w-9 animate-pulse items-center justify-center rounded-lg border border-slate-200/60 bg-slate-100" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <span className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200/60 bg-white p-2 transition-all duration-150 hover:bg-slate-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
                  <Menu className="h-4.5 w-4.5 text-slate-700" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl border-slate-200/80 bg-white p-1.5 shadow-[0_13px_27px_-5px_rgba(50,50,93,0.15),0_8px_16px_-8px_rgba(0,0,0,0.1)]">
                {isSessionReady ? (
                  <>
                    <div className="mb-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm">
                      <p className="font-semibold text-slate-900">{displayName}</p>
                      <p className="mt-0.5 text-[0.7rem] text-slate-400">{profileMeta}</p>
                      <p className="mt-0.5 text-[0.7rem] text-slate-400">{activeRoleSummary}</p>
                    </div>
                    {links.map(({ href, label, icon: Icon }) => (
                      <DropdownMenuItem key={href} className="rounded-lg">
                        <Link href={href} className="flex w-full items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem className="rounded-lg">
                      <Link href={profileHref} className="flex w-full items-center gap-2">
                        <UserRound className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => signOut()} className="rounded-lg text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : showGuestActions ? (
                  <>
                    <DropdownMenuItem className="rounded-lg">
                      <Link href="/auth/login" className="w-full">
                        Sign in
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg">
                      <Link href="/auth/register" className="w-full">
                        Get started
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-500">
                    Loading account...
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>
    </header>
  );
}
