type RequiredEnvKey =
  | 'DATABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

function readRequiredEnv(key: RequiredEnvKey) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getDatabaseUrl() {
  return readRequiredEnv('DATABASE_URL');
}

export function getSupabasePublicEnv() {
  return {
    url: readRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: readRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getSupabasePublicEnvSafe() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.trim().length === 0 || anonKey.trim().length === 0) {
    return null;
  }

  return { url, anonKey };
}
