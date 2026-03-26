'use client'
import { useEffect, useRef } from 'react'
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
  console.log('[AuthProvider] ensurePlayer: start', user.id)

  // 1. Try to fetch existing row
  console.log('[AuthProvider] ensurePlayer: fetching from players table...')
  
  // Add a timeout to avoid indefinite hanging in some environments
  const fetchPromise = supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('DATABASE_QUERY_TIMEOUT')), 8000)
  )

  let result: any
  try {
    result = await Promise.race([fetchPromise, timeoutPromise])
  } catch (err: any) {
    if (err.message === 'DATABASE_QUERY_TIMEOUT') {
      console.error('[AuthProvider] ensurePlayer: !! HANG DETECTED !! The query to the "players" table timed out after 8 seconds.')
      console.warn('[AuthProvider] ensurePlayer: This usually means the browser is blocking the request (Adblocker) or RLS policies are misconfigured.')
    }
    throw err
  }

  const { data: existing, error: fetchError } = result


  if (fetchError) {
    console.error('[AuthProvider] ensurePlayer: fetch error:', fetchError.message)
    if (fetchError.code !== 'PGRST116') return null
  }

  if (existing) {
    console.log('[AuthProvider] ensurePlayer: found existing:', existing.username)
    return existing as Player
  }

  // 2. No row yet — build a unique username
  console.log('[AuthProvider] ensurePlayer: no profile found, creating one...')
  let base     = deriveUsername(user)
  let username = base
  let suffix   = 1

  console.log('[AuthProvider] ensurePlayer: checking username availability:', username)
  while (true) {
    const { data: taken, error: checkError } = await supabase
      .from('players')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    
    if (checkError) {
       console.error('[AuthProvider] ensurePlayer: username check error:', checkError.message)
       break
    }
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

  console.log('[AuthProvider] ensurePlayer: inserting new row...', newPlayer)
  const { data: created, error: insertError } = await supabase
    .from('players')
    .insert(newPlayer)
    .select()
    .single()

  if (insertError) {
    console.error('[AuthProvider] ensurePlayer: insert error:', insertError.message)
    if (insertError.code === '23505') {
       console.log('[AuthProvider] ensurePlayer: race condition, trying second fetch...')
       const { data: secondFetch } = await supabase.from('players').select('*').eq('id', user.id).maybeSingle()
       if (secondFetch) return secondFetch as Player
    }
    return null
  }

  console.log('[AuthProvider] ensurePlayer: creation successful!', created.username)
  return created as Player
}

interface AuthProviderProps {
  children:      React.ReactNode
  initialUser?:   User | null
  initialPlayer?: Player | null
}

/**
 * Initializes auth state on mount and subscribes to auth changes.
 * Populates Zustand store with the current player profile.
 */
export default function AuthProvider({ children, initialUser, initialPlayer }: AuthProviderProps) {
  const setPlayer = useAppStore((s) => s.setPlayer)
  const router    = useRouter()
  const initialized = useRef(false)
  const loadingId = useRef<string | null>(null)

  // Immediate hydration if props are provided by the server
  if (!initialized.current) {
    if (initialPlayer) {
      setPlayer(initialPlayer)
      initialized.current = true
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient()

    async function loadPlayer(user: User) {
      if (loadingId.current === user.id) return
      loadingId.current = user.id
      
      console.log('[AuthProvider] -> loadPlayer started for:', user.id)
      try {
        console.log('[AuthProvider] -> calling ensurePlayer...')
        const player = await ensurePlayer(user)
        console.log('[AuthProvider] -> ensurePlayer returned:', player?.username || 'null')
        
        if (player) {
          setPlayer(player)
        } else {
          console.warn('[AuthProvider] -> ensurePlayer returned null, setting player to null')
          setPlayer(null)
        }
      } catch (err) {
        console.error('[AuthProvider] !! Exception in loadPlayer:', err)
        setPlayer(null)
      } finally {
        loadingId.current = null
      }
    }

    // We rely on onAuthStateChange (INITIAL_SESSION) for the initial load.
    // This prevents duplicate calls between getUser() and the subscription.

    // Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] ⚡ Auth state change event:', event, {
          sessionUserId: session?.user?.id,
          email: session?.user?.email
        })
        
        if (session?.user) {
          await loadPlayer(session.user)
        } else {
          console.log('[AuthProvider] No session in onAuthStateChange, clearing player')
          setPlayer(null)
        }

        if (event === 'SIGNED_OUT') {
          console.log('[AuthProvider] User signed out')
          // Only redirect if we are on a protected page. 
          // Public pages like leaderboard, players, lobby can stay.
          const publicPages = ['/leaderboard', '/players', '/lobby', '/maps']
          const isPublic = publicPages.some(path => window.location.pathname.startsWith(path)) || window.location.pathname === '/'
          
          if (!isPublic) {
            console.log('[AuthProvider] Not on public page, redirecting to home...')
            router.push('/')
          }
          router.refresh()
        }
      }
    )


    return () => subscription.unsubscribe()
  }, [setPlayer, router])

  return <>{children}</>
}
