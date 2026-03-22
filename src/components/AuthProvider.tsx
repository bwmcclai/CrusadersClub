'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { Player } from '@/types'

const DEFAULT_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C']

/**
 * Derives a safe starting username from Google metadata or email.
 * Strips spaces/special chars, truncates to 20 chars.
 */
function deriveUsername(user: User): string {
  const raw =
    user.user_metadata?.full_name  ||
    user.user_metadata?.name       ||
    user.email?.split('@')[0]      ||
    'Commander'
  return raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'Commander'
}

/**
 * Ensures a players row exists for this auth user.
 * - If the row already exists → return it as-is.
 * - If not (first OAuth login) → create it with sensible defaults
 *   derived from Google profile data, then return it.
 */
async function ensurePlayer(user: User): Promise<Player | null> {
  const supabase = getSupabaseClient()

  // 1. Try to fetch existing row
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return existing as Player

  // 2. No row yet — build a unique username
  let base     = deriveUsername(user)
  let username = base
  let suffix   = 1

  while (true) {
    const { data: taken } = await supabase
      .from('players')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (!taken) break
    username = `${base}${suffix++}`
  }

  // 3. Insert the new player row
  const newPlayer = {
    id:            user.id,
    username,
    avatar_url:    user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    default_color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
    xp:            0,
    level:         1,
    elo:           1000,
    games_played:  0,
    games_won:     0,
    games_lost:    0,
  }

  const { data: created, error } = await supabase
    .from('players')
    .insert(newPlayer)
    .select()
    .single()

  if (error) {
    console.error('[AuthProvider] Failed to create player row:', error.message)
    return null
  }

  return created as Player
}

/**
 * Initializes auth state on mount and subscribes to auth changes.
 * Populates Zustand store with the current player profile.
 * Automatically creates a players row for first-time OAuth users.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setPlayer } = useAppStore()
  const router        = useRouter()

  useEffect(() => {
    const supabase = getSupabaseClient()

    async function loadPlayer(user: User) {
      const player = await ensurePlayer(user)
      if (player) setPlayer(player)
      else         setPlayer(null)
    }

    // Load current session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadPlayer(user)
      else       setPlayer(null)
    })

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadPlayer(session.user)
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
