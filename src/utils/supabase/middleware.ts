import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnvSafe } from '@/lib/env'

type MiddlewareRoleState = 'active' | 'pending_verification' | 'rejected' | 'suspended' | 'not_applied';
type MiddlewareSystemRole = 'user' | 'admin';

function getRoleState(
  roleRows: Array<{ role_name: 'buyer' | 'farmer' | 'driver'; status: Exclude<MiddlewareRoleState, 'not_applied'> }>,
  roleName: 'buyer' | 'farmer' | 'driver',
): MiddlewareRoleState {
  const matchingRole = roleRows.find((role) => role.role_name === roleName);
  if (matchingRole) {
    return matchingRole.status;
  }

  return roleName === 'buyer' ? 'active' : 'not_applied';
}

export async function updateSession(request: NextRequest) {
  const supabaseEnv = getSupabasePublicEnvSafe()
  if (!supabaseEnv) {
    return NextResponse.next({ request })
  }
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isProtectedRoute = 
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/post-demand') ||
    pathname.startsWith('/post-shipment') ||
    pathname.startsWith('/browse-trips') ||
    pathname.startsWith('/browse') ||
    pathname.startsWith('/deals') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/matches') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/disputes') ||
    pathname.startsWith('/payment') ||
    pathname.startsWith('/trip/') ||
    pathname.startsWith('/users/');

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/auth/login') ||
    request.nextUrl.pathname.startsWith('/auth/register');
  const isCompleteProfileRoute = request.nextUrl.pathname.startsWith('/auth/complete-profile');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');

  let profile: { id: string; system_role: MiddlewareSystemRole } | null = null;
  let roleRows: Array<{ role_name: 'buyer' | 'farmer' | 'driver'; status: Exclude<MiddlewareRoleState, 'not_applied'> }> = [];
  if (user) {
    const { data } = await supabase.from('users').select('id, system_role').eq('id', user.id).maybeSingle();
    profile = data;

    if (profile) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role_name, status')
        .eq('user_id', user.id);

      roleRows = (roles as typeof roleRows | null) ?? [];
    }
  }

  // If user is not logged in and tries to access a protected route
  if (!user && (isProtectedRoute || isCompleteProfileRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && !profile && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/complete-profile'
    return NextResponse.redirect(url)
  }

  if (user && profile && isCompleteProfileRoute) {
    const url = request.nextUrl.clone()
    url.pathname = profile.system_role === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }
  
  // If user is logged in and tries to access auth routes
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = profile ? (profile.system_role === 'admin' ? '/admin' : '/dashboard') : '/auth/complete-profile'
    return NextResponse.redirect(url)
  }

  if (user && profile) {
    if (pathname.startsWith('/dashboard') && profile.system_role === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    if (isAdminRoute && profile.system_role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    const requiresFarmer = pathname.startsWith('/post-shipment')
    const requiresDriver = pathname.startsWith('/browse-trips')

    const farmerState = getRoleState(roleRows, 'farmer')
    const driverState = getRoleState(roleRows, 'driver')

    if (requiresFarmer && farmerState !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (requiresDriver && driverState !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
