import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title:       'Crusaders Club — Command the World',
  description: 'The modern AAA strategy battle game. Build maps, forge alliances, conquer the world.',
  keywords:    ['strategy', 'risk', 'board game', 'online', 'multiplayer', 'crusaders'],
  openGraph: {
    title:       'Crusaders Club',
    description: 'Command the World. The modern AAA strategy battle game.',
    type:        'website',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  
  // Pre-fetch auth user and player profile on the server for immediate hydration.
  const { data: { user } } = await supabase.auth.getUser()
  
  let initialPlayer = null
  if (user) {
    const { data } = await supabase.from('players').select('*').eq('id', user.id).maybeSingle()
    initialPlayer = data
  }

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect"                  href="https://fonts.googleapis.com" />
        <link rel="preconnect"                  href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-crusader-void text-crusader-gold-light antialiased min-h-screen">
        <AuthProvider initialUser={user} initialPlayer={initialPlayer}>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

