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
  const { data: existing, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[AuthProvider] Error fetching existing player:', fetchError.message)
    // If it's a transient error, we probably shouldn't try to insert
    if (fetchError.code !== 'PGRST116') return null // PGRST116 is "no rows found"
  }

  if (existing) return existing as Player

  // 2. No row yet — build a unique username
  console.log('[AuthProvider] Creating new player profile for:', user.id)
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

  const { data: created, error: insertError } = await supabase
    .from('players')
    .insert(newPlayer)
    .select()
    .single()

  if (insertError) {
    console.error('[AuthProvider] Failed to create player row:', insertError.message)
    // If it failed because it already exists (race condition), try fetching one last time
    if (insertError.code === '23505') {
       const { data: secondFetch } = await supabase.from('players').select('*').eq('id', user.id).maybeSingle()
       if (secondFetch) return secondFetch as Player
    }
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
      console.log('[AuthProvider] Loading player for user:', user.id)
      try {
        const player = await ensurePlayer(user)
        if (player) {
          console.log('[AuthProvider] Player loaded:', player.username)
          setPlayer(player)
        } else {
          console.warn('[AuthProvider] No player found or created for user')
          setPlayer(null)
        }
      } catch (err) {
        console.error('[AuthProvider] Failed to load/ensure player:', err)
        setPlayer(null)
      }
    }

    // Load current session on mount
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      console.log('[AuthProvider] Initial getUser check:', { hasUser: !!user, error })
      if (user) loadPlayer(user)
      else       setPlayer(null)
    })

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state change:', event, session?.user?.id)
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
