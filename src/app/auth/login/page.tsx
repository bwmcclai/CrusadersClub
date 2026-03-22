'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sword, Mail, Lock, Chrome } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { getSupabaseClient } from '@/lib/supabase'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') ?? '/'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(searchParams.get('error') === 'oauth_failed'
    ? 'Google sign-in failed. Please try again.'
    : '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  async function handleGoogle() {
    const supabase = getSupabaseClient()
    // Use window.location.origin so this automatically works in both
    // dev (localhost:3000) and prod (your real domain) with no env var needed.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
      },
    })
  }

  return (
    <div className="min-h-screen bg-crusader-void flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-crusader-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-crusader-glow/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <Sword size={28} className="text-crusader-gold" />
            <span className="font-cinzel text-2xl font-bold tracking-widest text-crusader-gold glow-gold">
              CRUSADERS CLUB
            </span>
          </Link>
          <p className="text-crusader-gold-light/50 mt-3 text-sm">Welcome back, Commander</p>
        </div>

        <Card className="p-8">
          {/* Google OAuth */}
          <Button
            onClick={handleGoogle}
            variant="outline"
            fullWidth
            size="lg"
            icon={<Chrome size={18} />}
            className="mb-6"
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="divider-gold flex-1" />
            <span className="text-xs text-crusader-gold/40 font-cinzel tracking-widest uppercase">or</span>
            <div className="divider-gold flex-1" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="commander@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={16} />}
              required
            />

            {error && (
              <p className="text-sm text-crusader-crimson-bright text-center">{error}</p>
            )}

            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs text-crusader-gold/50 hover:text-crusader-gold transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} size="lg" fullWidth className="mt-2">
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-crusader-gold-light/40 mt-6">
            No account?{' '}
            <Link href="/auth/register" className="text-crusader-gold hover:text-crusader-gold-light transition-colors">
              Join the Club
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-crusader-void flex items-center justify-center p-4">
        <div className="text-crusader-gold font-cinzel animate-pulse">Initializing...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
