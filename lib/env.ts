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

export const publicEnv = {
  supabaseUrl: () =>
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () =>
    required(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
}

export const serverEnv = {
  serviceRoleKey: () =>
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  anthropicKey: () =>
    required(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
  cronSecret: () => required(process.env.CRON_SECRET, 'CRON_SECRET'),
}
