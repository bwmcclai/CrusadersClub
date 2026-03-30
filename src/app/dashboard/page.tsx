'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  Sword, Map, Trophy, TrendingUp, Clock,
  Shield, ChevronRight, Plus, Users, Loader2,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ActiveGame {
  id: string
  name: string
  mode: string
  map_name: string
  current_turn_player_id: string | null
  my_game_player_id: string
  turn_deadline: string | null
  current_players: number
}

interface RecentGame {
  id: string
  name: string
  mode: string
  status: string
  winner_id: string | null
  my_player_id: string | null
  finished_at: string
}

interface MyMap {
  id: string
  name: string
  territory_count: number
  play_count: number
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function StatSkeleton() {
  return (
    <Card className="p-5">
      <div className="animate-pulse">
        <div className="h-3 w-16 bg-crusader-gold/10 rounded mb-3" />
        <div className="h-7 w-12 bg-crusader-gold/10 rounded" />
      </div>
    </Card>
  )
}

function GameSkeleton() {
  return (
    <Card className="p-5">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-24 bg-crusader-gold/10 rounded" />
        <div className="h-4 w-48 bg-crusader-gold/10 rounded" />
        <div className="h-3 w-32 bg-crusader-gold/10 rounded" />
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const player = useAppStore(s => s.player)
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([])
  const [recentGames, setRecentGames] = useState<RecentGame[]>([])
  const [myMaps, setMyMaps] = useState<MyMap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!player) return
    const sb = getSupabaseClient()
    let cancelled = false

    async function load() {
      try {
        setLoading(true)

        // Fetch active games where this player is participating
        const { data: gpRows } = await sb
          .from('game_players')
          .select('id, game_id, games:game_id(id, name, mode, status, current_turn_player_id, turn_deadline, current_players, map_id, battle_maps:map_id(name))')
          .eq('player_id', player!.id)
          .eq('is_eliminated', false)

        if (!cancelled) {
          const active: ActiveGame[] = []
          const recent: RecentGame[] = []
          for (const row of gpRows ?? []) {
            const g = (row as any).games
            if (!g) continue
            if (g.status === 'active' || g.status === 'waiting') {
              active.push({
                id: g.id,
                name: g.name,
                mode: g.mode,
                map_name: g.battle_maps?.name ?? 'Unknown Map',
                current_turn_player_id: g.current_turn_player_id,
                my_game_player_id: row.id,
                turn_deadline: g.turn_deadline,
                current_players: g.current_players,
              })
            } else if (g.status === 'finished') {
              recent.push({
                id: g.id,
                name: g.name,
                mode: g.mode,
                status: g.status,
                winner_id: g.winner_id ?? null,
                my_player_id: player!.id,
                finished_at: g.updated_at ?? g.created_at ?? '',
              })
            }
          }
          setActiveGames(active)
          setRecentGames(recent.slice(0, 5))
        }

        // Fetch player's maps
        const { data: mapRows } = await sb
          .from('battle_maps')
          .select('id, name, territories, play_count')
          .eq('author_id', player!.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!cancelled && mapRows) {
          setMyMaps(mapRows.map(m => ({
            id: m.id,
            name: m.name,
            territory_count: Array.isArray(m.territories) ? m.territories.length : 0,
            play_count: m.play_count ?? 0,
          })))
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [player])

  if (!player) {
    return (
      <div className="min-h-screen bg-crusader-void flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-crusader-gold/40 mx-auto mb-4" />
          <p className="text-crusader-gold/40 font-cinzel text-sm">Loading profile...</p>
        </div>
      </div>
    )
  }

  const winRate = player.games_played > 0 ? Math.round((player.games_won / player.games_played) * 100) : 0

  // Determine rank from level
  const RANKS = ['Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'General', 'Marshal', 'Grand Crusader', 'Supreme Crusader']
  const rankIdx = Math.min(Math.floor(player.level / 5), RANKS.length - 1)
  const rank = RANKS[rankIdx]

  return (
    <div className="min-h-screen bg-crusader-void">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-crusader-gold/60 text-sm font-cinzel tracking-widest uppercase mb-1">Dashboard</p>
            <h1 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold">
              Welcome back, {player.username}
            </h1>
            <p className="text-crusader-gold-light/40 text-sm mt-1">
              Rank: <span className="text-crusader-gold">{rank}</span>
              {' '}· ELO: <span className="text-crusader-gold">{player.elo}</span>
              {' '}· Level {player.level}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/lobby">
              <Button icon={<Sword size={16} />}>Find Game</Button>
            </Link>
            <Link href="/map-creator">
              <Button variant="outline" icon={<Plus size={16} />}>New Map</Button>
            </Link>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Games Played', value: player.games_played, icon: Sword,      color: 'text-crusader-gold' },
              { label: 'Victories',    value: player.games_won,    icon: Trophy,     color: 'text-yellow-400'    },
              { label: 'Win Rate',     value: `${winRate}%`,       icon: TrendingUp, color: 'text-green-400'     },
              { label: 'ELO Rating',   value: player.elo,          icon: Shield,     color: 'text-crusader-glow' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Icon size={16} className={color} />
                  <span className="text-xs text-crusader-gold/50 font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className={`font-cinzel text-2xl font-bold ${color}`}>{value}</div>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-400/30 bg-red-400/5 text-red-400 text-sm font-cinzel">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Active Games ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-cinzel text-lg font-semibold text-crusader-gold">Active Battles</h2>
              <Link href="/lobby" className="text-xs text-crusader-gold/50 hover:text-crusader-gold flex items-center gap-1">
                All games <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              [1, 2, 3].map(i => <GameSkeleton key={i} />)
            ) : activeGames.length === 0 ? (
              <Card className="p-8 text-center">
                <Sword size={24} className="mx-auto mb-3 text-crusader-gold/20" />
                <p className="text-crusader-gold/40 font-cinzel text-sm">No active battles</p>
                <Link href="/lobby" className="inline-block mt-3">
                  <Button size="sm">Find a Game</Button>
                </Link>
              </Card>
            ) : (
              activeGames.map((game) => {
                const yourTurn = game.current_turn_player_id === game.my_game_player_id
                const modeLabel = game.mode === 'lightning' ? '⚡ Lightning' : game.mode === 'slow_hour' ? '⏱ Slow' : '📅 Daily'
                const modeColor = game.mode === 'lightning' ? 'text-crusader-gold' : 'text-crusader-glow'

                let deadline = ''
                if (game.turn_deadline) {
                  const ms = new Date(game.turn_deadline).getTime() - Date.now()
                  if (ms > 0) {
                    if (ms < 3_600_000) deadline = `${Math.ceil(ms / 60_000)} min`
                    else if (ms < 86_400_000) deadline = `${Math.ceil(ms / 3_600_000)}h remaining`
                    else deadline = `${Math.ceil(ms / 86_400_000)}d remaining`
                  } else {
                    deadline = 'overdue'
                  }
                }

                return (
                  <Card key={game.id} hover glow="gold" className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {yourTurn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-crusader-gold/20 text-crusader-gold text-xs font-medium border border-crusader-gold/30 animate-pulse-slow">
                              Your Turn
                            </span>
                          )}
                          <span className={`text-xs ${modeColor}`}>{modeLabel}</span>
                        </div>
                        <h3 className="font-cinzel font-semibold text-crusader-gold-light truncate">{game.name}</h3>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-crusader-gold/40">
                          <span className="flex items-center gap-1"><Map size={11} /> {game.map_name}</span>
                          <span className="flex items-center gap-1"><Users size={11} /> {game.current_players} players</span>
                          {deadline && <span className="flex items-center gap-1"><Clock size={11} /> {deadline}</span>}
                        </div>
                      </div>
                      <Link href={`/game/${game.id}`}>
                        <Button size="sm" variant={yourTurn ? 'gold' : 'outline'}>
                          {yourTurn ? 'Attack!' : 'View'}
                        </Button>
                      </Link>
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Recent results */}
            <div>
              <h2 className="font-cinzel text-lg font-semibold text-crusader-gold mb-4">Recent Battles</h2>
              {loading ? (
                <Card className="p-5"><GameSkeleton /></Card>
              ) : recentGames.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-crusader-gold/30 font-cinzel">No recent battles</p>
                </Card>
              ) : (
                <Card className="divide-y divide-crusader-gold/10">
                  {recentGames.map((game) => {
                    const won = game.winner_id === game.my_player_id
                    return (
                      <Link key={game.id} href={`/game/${game.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-crusader-gold/5 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${won ? 'bg-green-400' : 'bg-crusader-crimson-bright'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-crusader-gold-light/80 truncate font-medium">{game.name}</p>
                          <p className="text-xs text-crusader-gold/30 mt-0.5">{game.mode}</p>
                        </div>
                        <span className={`text-xs font-semibold uppercase ${won ? 'text-green-400' : 'text-crusader-crimson-bright'}`}>
                          {won ? 'Win' : 'Loss'}
                        </span>
                      </Link>
                    )
                  })}
                </Card>
              )}
            </div>

            {/* My Maps */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-cinzel text-lg font-semibold text-crusader-gold">My Maps</h2>
                <Link href="/map-creator">
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />}>New</Button>
                </Link>
              </div>
              {loading ? (
                <GameSkeleton />
              ) : myMaps.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-crusader-gold/30 font-cinzel">No maps yet</p>
                  <Link href="/map-creator" className="inline-block mt-2">
                    <Button size="sm" variant="outline" icon={<Plus size={12} />}>Create Map</Button>
                  </Link>
                </Card>
              ) : (
                <div className="space-y-3">
                  {myMaps.map((map) => (
                    <Link key={map.id} href={`/maps/${map.id}`}>
                      <Card hover glow="gold" className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-cinzel text-sm font-semibold text-crusader-gold">{map.name}</p>
                            <p className="text-xs text-crusader-gold/40 mt-0.5">{map.territory_count} territories · {map.play_count} plays</p>
                          </div>
                          <Map size={16} className="text-crusader-gold/40" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
