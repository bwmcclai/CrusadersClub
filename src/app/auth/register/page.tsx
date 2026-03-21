'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Sword, Mail, Lock, User, Chrome } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

export default function RegisterPage() {
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    // TODO: Supabase auth.signUp({ email, password }) + insert profile
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-crusader-void flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-crusader-crimson/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-crusader-gold/5 rounded-full blur-3xl" />
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
          <p className="text-crusader-gold-light/50 mt-3 text-sm">Join the battle. Forge your legacy.</p>
        </div>

        <Card className="p-8">
          {/* Google OAuth */}
          <Button
            onClick={() => console.log('Google OAuth')}
            variant="outline"
            fullWidth
            size="lg"
            icon={<Chrome size={18} />}
            className="mb-6"
          >
            Sign up with Google
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="divider-gold flex-1" />
            <span className="text-xs text-crusader-gold/40 font-cinzel tracking-widest uppercase">or</span>
            <div className="divider-gold flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Commander Name"
              type="text"
              placeholder="YourLegend"
              value={form.username}
              onChange={update('username')}
              icon={<User size={16} />}
              hint="Your public battle name"
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="commander@example.com"
              value={form.email}
              onChange={update('email')}
              icon={<Mail size={16} />}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={update('password')}
              icon={<Lock size={16} />}
              hint="At least 8 characters"
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={update('confirm')}
              icon={<Lock size={16} />}
              error={form.confirm && form.password !== form.confirm ? 'Passwords do not match' : undefined}
              required
            />

            {error && (
              <p className="text-sm text-crusader-crimson-bright text-center">{error}</p>
            )}

            <p className="text-xs text-crusader-gold/30 text-center">
              By joining you agree to our{' '}
              <a href="#" className="text-crusader-gold/60 hover:text-crusader-gold">Terms</a>{' '}
              and{' '}
              <a href="#" className="text-crusader-gold/60 hover:text-crusader-gold">Privacy Policy</a>
            </p>

            <Button type="submit" loading={loading} size="lg" fullWidth className="mt-2">
              Join the Club
            </Button>
          </form>

          <p className="text-center text-sm text-crusader-gold-light/40 mt-6">
            Already a member?{' '}
            <Link href="/auth/login" className="text-crusader-gold hover:text-crusader-gold-light transition-colors">
              Sign In
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
