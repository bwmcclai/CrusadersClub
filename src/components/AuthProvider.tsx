'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { Player } from '@/types'

/**
 * Initializes auth state on mount and subscribes to auth changes.
 * Populates Zustand store with the current player profile.
 * Must be rendered inside a client component tree (wrap in layout).
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setPlayer } = useAppStore()
  const router        = useRouter()

  useEffect(() => {
    const supabase = getSupabaseClient()

    async function loadPlayer(userId: string) {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) setPlayer(data as Player)
    }

    // Load current session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadPlayer(user.id)
      else       setPlayer(null)
    })

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadPlayer(session.user.id)
        } else {
          setPlayer(null)
        }

        if (event === 'SIGNED_OUT') {
          router.push('/')
          router.refresh()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setPlayer, router])

  return <>{children}</>
}
