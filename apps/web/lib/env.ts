/**
 * Environment access.
 *
 * The Supabase URL and publishable (anon) key are public by design: they ship
 * in every browser bundle, and the data behind them is protected by RLS and
 * the signup allowlist — not by hiding these strings. They are therefore baked
 * in as defaults so a deployment works with no environment variables at all.
 *
 * Environment variables, when present and non-empty, still override the
 * defaults (SUPABASE_URL beats NEXT_PUBLIC_SUPABASE_URL beats the default).
 * Empty strings are ignored: Vercel withholds "Sensitive" values from the
 * build step, which inlines NEXT_PUBLIC_* as "" — the failure mode that took
 * the site down before.
 */
const DEFAULTS = {
  supabaseUrl: 'https://ywkarxdiaptbuwsaqvge.supabase.co',
  supabaseAnonKey: 'sb_publishable_DS6xEKiIpcwH0VKCohsWqg_ZaCi0vtp',
  siteUrl: 'https://www.gwoops.com',
}

function first(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value) return value
  }
  return undefined
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export const publicEnv = {
  supabaseUrl: () =>
    first(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL) ??
    DEFAULTS.supabaseUrl,

  supabaseAnonKey: () =>
    first(
      process.env.SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ) ?? DEFAULTS.supabaseAnonKey,

  siteUrl: () =>
    first(process.env.NEXT_PUBLIC_SITE_URL) ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : DEFAULTS.siteUrl),

  /** Same values, bundled for the middleware. Never throws, never null. */
  supabaseConfig: (): SupabaseConfig => ({
    url: publicEnv.supabaseUrl(),
    anonKey: publicEnv.supabaseAnonKey(),
  }),
}

export const serverEnv = {
  serviceRoleKey: () =>
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  anthropicKey: () =>
    required(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
  cronSecret: () => required(process.env.CRON_SECRET, 'CRON_SECRET'),
}
