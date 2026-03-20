import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnvSafe } from '@/lib/env'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createClient(): SupabaseClient | null {
  const supabaseEnv = getSupabasePublicEnvSafe()
  if (!supabaseEnv) {
    return null
  }

  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.anonKey
  )
}

export function getClientEnvError() {
  return getSupabasePublicEnvSafe()
    ? null
    : 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
}
