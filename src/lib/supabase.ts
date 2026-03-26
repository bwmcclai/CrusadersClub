import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a new Supabase client for browser use.
 * We add explicit auth configuration to help with Tab/Lock contention in dev environments.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Bypass the Navigator Lock API to prevent "stolen lock" errors in development.
        // GoTrueClient calls this with (name, timeout, callback).
        lock: async (_name: string, _timeout: number, callback: () => Promise<any>) => {
          return await callback()
        }
      }
    }
  )
}

// Singleton for use in client components
let _client: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Return a fresh client for SSR if called on server (though supabase-server.ts is preferred)
    return createClient()
  }
  
  if (!_client) {
    console.log('[Supabase] Initializing browser client singleton...')
    _client = createClient()
  }
  return _client
}
