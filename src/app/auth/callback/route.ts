import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * OAuth callback handler.
 * Supabase redirects here after Google OAuth with ?code=...
 *
 * IMPORTANT: we must bind the Supabase client to the redirect response
 * (not to cookieStore from next/headers) so that the session cookies
 * are actually set on the response the browser receives.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/'

  if (code) {
    // Build the redirect response first, then attach cookies to it.
    const redirectResponse = NextResponse.redirect(`${origin}${redirect}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            // Write session cookies directly onto the redirect response.
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse  // carries the session cookies
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
}
