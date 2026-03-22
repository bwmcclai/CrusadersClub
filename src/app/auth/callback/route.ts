import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * OAuth callback handler.
 * Supabase redirects here after Google OAuth with ?code=...
 * We exchange the code for a session, then redirect to dashboard (or original destination).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // Auth failed — send back to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
}
