import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * OAuth callback handler.
 * Supabase redirects here after Google OAuth with ?code=...
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Use absolute URL for redirect to ensure it works across all environments.
      // origin is derived from request.url which is robust in Next.js 15 / Vercel.
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // Redirect to login with error if something went wrong
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
}

