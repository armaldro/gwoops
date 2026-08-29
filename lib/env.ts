/**
 * Environment access with a clear failure message. Next.js inlines
 * NEXT_PUBLIC_* at build time, so those must be referenced literally rather
 * than through a dynamic index.
 */
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
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () =>
    required(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  /**
   * Non-throwing variant, for the one caller that must never crash.
   *
   * Middleware runs on every request, so a throw there is a 500 on the whole
   * site — including the page that would explain the misconfiguration. It asks
   * whether Supabase is configured and degrades when it is not, rather than
   * being handed an exception.
   *
   * Note for operators: NEXT_PUBLIC_* values are inlined at build time, so
   * these read as undefined until a *redeploy* follows setting them.
   */
  supabaseConfig: (): SupabaseConfig | null => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && anonKey ? { url, anonKey } : null
  },
}

export const serverEnv = {
  serviceRoleKey: () =>
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  anthropicKey: () =>
    required(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
  cronSecret: () => required(process.env.CRON_SECRET, 'CRON_SECRET'),
}
