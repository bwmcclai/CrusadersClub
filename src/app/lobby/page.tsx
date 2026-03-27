'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { Sword, Map, Users, Zap, Shield, Clock, Search, Plus, Filter, Bot, Globe, PenTool } from 'lucide-react'
import { formatMode, cameraDistanceFromBounds, boundsToFocusLatLon } from '@/lib/utils'
import { createGame } from '@/lib/gameService'
import { motion } from 'framer-motion'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { Player, LobbyGame, GameMode, Territory } from '@/types'
import dynamic from 'next/dynamic'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-crusader-void/50">
      <div className="w-10 h-10 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
    </div>
  ),
})

// ─── Data fetch utilities ─────────────────────────────────────────────────────

// ─── Components ──────────────────────────────────────────────────────────────

function GameCard({
  game,
  territories,
  onPreviewGlobe,
  player,
}: {
  game: LobbyGame
  territories: Territory[] | null
  onPreviewGlobe: () => void
  player: Player | null
}) {
  const isFull      = game.current_players >= game.max_players
  const selectedIds = game.country_iso_ids ?? []
  const focusLatLon: [number, number] | undefined = game.region_bounds
    ? boundsToFocusLatLon(game.region_bounds)
    : undefined

  const camDist = game.region_bounds ? cameraDistanceFromBounds(game.region_bounds) : 2.0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative flex flex-row overflow-hidden rounded-sm border bg-crusader-void/80 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 ${
        isFull
          ? 'border-crusader-gold/10'
          : 'border-crusader-gold/20 hover:border-crusader-gold/50 hover:shadow-[0_8px_40px_rgba(201,168,76,0.15)]'
      }`}
    >
      {/* Gold top line */}
      {!isFull && <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-crusader-gold/40 to-transparent z-10 pointer-events-none" />}

      {/* ── Info side (Left) ────────────────────────────────────────────── */}
      <div className="w-[60%] p-5 flex flex-col justify-between min-w-0 border-r border-crusader-gold/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Map + AI badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <Map size={11} className="text-crusader-gold/40 flex-shrink-0" />
              <span className="text-[10px] font-cinzel text-crusader-gold/50 tracking-widest truncate">{game.map_name}</span>
              {game.has_ai && (
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border border-crusader-steel/40 text-crusader-gold/60 bg-crusader-steel/20 flex-shrink-0">
                  <Bot size={8} className="inline mr-0.5" />AI
                </span>
              )}
            </div>
            <h3 className="font-cinzel text-lg font-bold text-crusader-parchment truncate leading-tight">{game.name}</h3>
            <p className="text-xs text-crusader-gold/50 flex items-center gap-1.5 mt-1">
              <Shield size={11} className="text-crusader-gold/30" /> Hosted by {game.creator_name || 'System'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${
              game.mode === 'lightning'
                ? 'border-crusader-gold/30 text-crusader-gold bg-crusader-gold/10'
                : 'border-crusader-glow/30 text-crusader-glow bg-crusader-glow/10'
            }`}>
              {game.mode === 'lightning' ? '⚡ Light' : game.mode === 'slow_hour' ? '⏱ 1hr' : '📅 1day'}
            </span>
            {game.status === 'active' && (
              <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-green-500/30 text-green-400 bg-green-500/10">
                In Progress
              </span>
            )}
          </div>
        </div>

        {/* Player slots + Join */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-crusader-gold/10">
          <div className="flex items-center gap-2 flex-1 mr-4">
            <Users size={13} className="text-crusader-gold/50 flex-shrink-0" />
            <div className="flex gap-1 flex-1 max-w-[120px]">
              {Array.from({ length: game.max_players }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < game.current_players ? 'bg-crusader-gold shadow-glow-gold' : 'bg-crusader-dark border border-crusader-gold/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-cinzel font-bold text-crusader-gold/70 flex-shrink-0">
              {game.current_players}/{game.max_players}
            </span>
          </div>
          {player ? (
            <Link href={`/game/${game.id}`}>
              <Button size="sm" variant={isFull ? 'ghost' : 'gold'} disabled={isFull && game.status === 'active'} className="px-6 h-8 text-xs">
                {game.status === 'active' ? 'Watch' : isFull ? 'Spectate' : 'Join'}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" className="px-6 h-8 text-xs opacity-50 cursor-not-allowed" title="Login to Join">
              Join
            </Button>
          )}
        </div>
      </div>

      {/* ── Globe side (Right) ─────────────────────────────────────────────── */}
      <div
        className="relative w-[40%] flex-shrink-0 bg-crusader-void overflow-hidden cursor-pointer group/globe min-h-[140px]"
        onClick={onPreviewGlobe}
      >
        <EarthGlobe
          interactive={false}
          autoRotate={false}
          selectionMode="none"
          selectedIds={selectedIds}
          territories={territories ?? []}
          focusLatLon={focusLatLon}
          cameraDistance={camDist}
          showStars={false}
          showContinentLabels={false}
          className="absolute inset-0 w-full h-full"
        />
        {/* Fade into card body - Flipped to L gradient */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-crusader-void/80 to-transparent pointer-events-none" />
        {/* Hover hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/globe:opacity-100 transition-opacity bg-crusader-void/40 backdrop-blur-sm">
          <span className="font-cinzel text-xs text-crusader-gold tracking-widest flex items-center gap-2">
            <Globe size={13} /> Full Globe
          </span>
        </div>
      </div>

    </motion.div>
  )
}

// ─── Create Game Modal ────────────────────────────────────────────────────────

interface CreateGameForm {
  name:       string
  mode:       GameMode
  maxPlayers: number
  mapId:      string
  aiCount:    number
}

interface BattleMapPreview {
  id: string; name: string; territories: number; rating: number; plays: number
}

function CreateGameModal({
  open, onClose, initialMapId, initialMode, initialMaxPlayers, initialAiCount,
}: {
  open: boolean
  onClose: () => void
  initialMapId?: string
  initialMode?: GameMode
  initialMaxPlayers?: number
  initialAiCount?: number
}) {
  const router = useRouter()
  const [form, setForm] = useState<CreateGameForm>({
    name: '', mode: initialMode ?? 'lightning',
    maxPlayers: initialMaxPlayers ?? 4,
    mapId: initialMapId ?? '',
    aiCount: initialAiCount ?? 0,
  })
  const [maps, setMaps] = useState<BattleMapPreview[]>([])
  const [loading, setLoading] = useState(false)

  // Sync initial props when modal opens with pre-selected map
  useEffect(() => {
    if (open && initialMapId) {
      setForm((f) => ({
        ...f,
        mapId:      initialMapId ?? f.mapId,
        mode:       initialMode ?? f.mode,
        maxPlayers: initialMaxPlayers ?? f.maxPlayers,
        aiCount:    initialAiCount ?? f.aiCount,
      }))
    }
  }, [open, initialMapId, initialMode, initialMaxPlayers, initialAiCount])

  // Fetch real maps from Supabase
  useEffect(() => {
    async function fetchMaps() {
      try {
        const { data } = await getSupabaseClient()
          .from('battle_maps')
          .select('id, name, territories, play_count')
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(8)
        if (data && data.length > 0) {
          setMaps(data.map((m: any) => ({
            id:          m.id,
            name:        m.name,
            territories: Array.isArray(m.territories) ? m.territories.length : 0,
            rating:      0,
            plays:       m.play_count ?? 0,
          })))
        }
      } catch {/* keep mock data */}
    }
    fetchMaps()
  }, [])

  const player = useAppStore(s => s.player)

  async function handleCreate() {
    if (!player || !form.name.trim() || !form.mapId) return
    setLoading(true)
    try {
      const gameId = await createGame({
        name: form.name.trim(),
        mapId: form.mapId,
        mode: form.mode,
        maxPlayers: form.maxPlayers,
        aiCount: form.aiCount,
        creatorId: player.id,
        creatorName: player.username,
        creatorAvatar: player.avatar_url,
      })
      router.push(`/game/${gameId}`)
    } catch (err) {
      console.error('Create game failed:', err)
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Game" size="md">
      <div className="flex flex-col gap-5">
        <Input
          label="Game Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Name your battle..."
        />

        {/* Mode */}
        <div>
          <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">Game Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'lightning', label: '⚡ Lightning', sub: '1 min/turn' },
              { id: 'slow_hour', label: '⏱ Slow',      sub: '1 hr/turn'  },
              { id: 'slow_day',  label: '📅 Epic',      sub: '1 day/turn' },
            ] as const).map(({ id, label, sub }) => (
              <button
                key={id}
                onClick={() => setForm((f) => ({ ...f, mode: id }))}
                className={`p-3 rounded-xl border text-center transition-all ${
                  form.mode === id
                    ? 'border-crusader-gold/60 bg-crusader-gold/15 text-crusader-gold'
                    : 'border-crusader-gold/10 text-crusader-gold/40 hover:border-crusader-gold/30'
                }`}
              >
                <div className="text-sm font-cinzel font-medium">{label}</div>
                <div className="text-xs mt-0.5 opacity-60">{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Map select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80">Select Map</label>
            <Link
              href="/map-creator"
              className="flex items-center gap-1 text-xs text-crusader-gold/50 hover:text-crusader-gold transition-colors"
              onClick={onClose}
            >
              <PenTool size={11} /> Create New Map
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto scrollbar-none">
            {maps.map((map) => (
              <button
                key={map.id}
                onClick={() => setForm((f) => ({ ...f, mapId: map.id }))}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.mapId === map.id
                    ? 'border-crusader-gold/60 bg-crusader-gold/15'
                    : 'border-crusader-gold/10 hover:border-crusader-gold/30'
                }`}
              >
                <div className="text-sm font-medium text-crusader-gold-light/80 truncate">{map.name}</div>
                <div className="text-xs text-crusader-gold/40 mt-0.5">{map.territories} territories</div>
              </button>
            ))}
          </div>
          {maps.length === 0 && (
            <div className="text-center py-6 border border-dashed border-crusader-gold/20 rounded-xl">
              <p className="text-xs text-crusader-gold/40 mb-3">No maps yet. Create the first one!</p>
              <Link href="/map-creator" onClick={onClose}>
                <Button size="sm" variant="outline" icon={<PenTool size={12} />}>Open Map Creator</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">
              Max Players: <span className="text-crusader-gold">{form.maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={8} value={form.maxPlayers}
              onChange={(e) => {
                const v = Number(e.target.value)
                setForm((f) => ({ ...f, maxPlayers: v, aiCount: Math.min(f.aiCount, v - 1) }))
              }}
              className="w-full accent-crusader-gold"
            />
          </div>
          <div>
            <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">
              AI Bots: <span className="text-crusader-gold">{form.aiCount}</span>
            </label>
            <input
              type="range" min={0} max={form.maxPlayers - 1} value={form.aiCount}
              onChange={(e) => setForm((f) => ({ ...f, aiCount: Number(e.target.value) }))}
              className="w-full accent-crusader-gold"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose}>Cancel</Button>
          <Button
            fullWidth
            loading={loading}
            disabled={!form.name.trim() || !form.mapId}
            icon={<Sword size={16} />}
            onClick={handleCreate}
          >
            Create Game
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Map preview data ─────────────────────────────────────────────────────────

interface MapCacheEntry {
  territories:     Territory[]
  country_iso_ids: number[]
}

export default function LobbyPage() {
  const player = useAppStore(s => s.player)
  const searchParams   = useSearchParams()
  const [search, setSearch]           = useState('')
  const [modeFilter, setModeFilter]   = useState<GameMode | 'all'>('all')
  const [showCreate, setShowCreate]   = useState(false)
  const [games, setGames]             = useState<LobbyGame[]>([])
  const [mapCache, setMapCache]       = useState<Record<string, MapCacheEntry>>({})
  const [page, setPage]               = useState(0)
  const [hasMore, setHasMore]         = useState(true)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [featuredMaps, setFeaturedMaps] = useState<any[]>([])

  // Globe Preview Modal State
  const [previewGlobe, setPreviewGlobe] = useState<{
    regionName:  string
    territories: Territory[]
    selectedIds: number[]
    focusLatLon?: [number, number]
  } | null>(null)

  const PAGE_SIZE = 12

  async function fetchMapData(mapIds: string[]) {
    if (mapIds.length === 0) return
    const { data } = await getSupabaseClient()
      .from('battle_maps')
      .select('id, territories, country_iso_ids')
      .in('id', mapIds)
    if (!data) return
    const entries: Record<string, MapCacheEntry> = {}
    for (const m of data as any[]) {
      entries[m.id] = {
        territories:     Array.isArray(m.territories) ? m.territories : [],
        country_iso_ids: Array.isArray(m.country_iso_ids) ? m.country_iso_ids : [],
      }
    }
    setMapCache(prev => ({ ...prev, ...entries }))
  }

  async function fetchGames(pageNumber: number, isInitial: boolean = false) {
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    const supabase = getSupabaseClient()
    const from = pageNumber * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    try {
      const { data, error } = await supabase
        .from('lobby_games')
        .select('id, name, status, mode, max_players, current_players, created_at, map_id, map_name, region_name, region_bounds, country_iso_ids, has_ai, creator_name')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      if (data) {
        const newGames = data as unknown as LobbyGame[]
        if (isInitial) setGames(newGames)
        else setGames(prev => [...prev, ...newGames])
        setHasMore(newGames.length === PAGE_SIZE)

        // Batch-fetch territory data for any map_ids we don't have cached yet
        const uncached = Array.from(new Set(newGames.map(g => g.map_id).filter(Boolean)))
          .filter(id => !mapCache[id])
        fetchMapData(uncached)
      }
    } catch (e) {
      console.error('Failed to fetch lobby games:', e)
    } finally {
      if (isInitial) setLoading(false)
      else setLoadingMore(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchGames(0, true)

    async function fetchFeatured() {
      const supabase = getSupabaseClient()
      const { data: mapsData } = await supabase
        .from('battle_maps')
        .select('id, name, territories, play_count')
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(4)

      if (mapsData) {
        setFeaturedMaps(mapsData.map((m: any) => ({
          id:          m.id,
          name:        m.name,
          territories: Array.isArray(m.territories) ? m.territories.length : 0,
          rating:      5.0,
          plays:       m.play_count ?? 0,
        })))
      }
    }
    fetchFeatured()
  }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchGames(nextPage)
  }

  // Pre-populate from Map Creator redirect (?newMapId=xxx&mode=...&maxPlayers=...&aiCount=...)
  const newMapId      = searchParams.get('newMapId')    ?? undefined
  const presetMode    = (searchParams.get('mode')       ?? undefined) as GameMode | undefined
  const presetPlayers = searchParams.get('maxPlayers')  ? Number(searchParams.get('maxPlayers'))  : undefined
  const presetAi      = searchParams.get('aiCount')     ? Number(searchParams.get('aiCount'))     : undefined

  useEffect(() => {
    if (newMapId) setShowCreate(true)
  }, [newMapId])

  // Helper: open globe modal for a game
  function openGlobePreview(game: LobbyGame) {
    const cached = mapCache[game.map_id]
    const territories  = cached?.territories     ?? []
    const selectedIds  = cached?.country_iso_ids ?? game.country_iso_ids ?? []
    const bounds       = game.region_bounds
    const focusLatLon: [number, number] | undefined = bounds
      ? boundsToFocusLatLon(bounds)
      : undefined
    setPreviewGlobe({ regionName: game.region_name, territories, selectedIds, focusLatLon })
  }

  const filtered = games.filter((g) => {
    const creatorName = g.creator_name || 'System'
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.map_name.toLowerCase().includes(search.toLowerCase()) || creatorName.toLowerCase().includes(search.toLowerCase())
    const matchMode   = modeFilter === 'all' || g.mode === modeFilter
    return matchSearch && matchMode
  })

  const waiting = filtered.filter((g) => g.status === 'waiting')
  const active  = filtered.filter((g) => g.status === 'active')

  return (
    <div className="min-h-screen bg-crusader-void">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold">Game Lobby</h1>
            <p className="text-crusader-gold/50 text-sm mt-1">
              {waiting.length} games waiting · {active.length} games in progress
            </p>
          </div>
          <Button 
            icon={<Plus size={18} />} 
            size="lg" 
            onClick={() => setShowCreate(true)}
            disabled={!player}
            title={!player ? 'Login to create a game' : undefined}
          >
            Create Game
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Game list ──────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crusader-gold/30" />
                <input
                  type="text"
                  placeholder="Search games or maps..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-crusader-navy/60 border border-crusader-gold/20 text-sm text-crusader-gold-light placeholder:text-crusader-gold/30 focus:outline-none focus:border-crusader-gold/50"
                />
              </div>
              <div className="flex gap-2">
                {([
                  { id: 'all',       label: 'All' },
                  { id: 'lightning', label: '⚡' },
                  { id: 'slow_hour', label: '⏱' },
                  { id: 'slow_day',  label: '📅' },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setModeFilter(id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border
                      ${modeFilter === id
                        ? 'bg-crusader-gold/20 text-crusader-gold border-crusader-gold/40'
                        : 'bg-transparent text-crusader-gold/40 border-crusader-gold/10 hover:border-crusader-gold/30'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Waiting games */}
            {waiting.length > 0 && (
              <div>
                <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-3">
                  Open — Join Now
                </h2>
                <div className="flex flex-col gap-4">
                  {waiting.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      territories={mapCache[g.map_id]?.territories ?? null}
                      onPreviewGlobe={() => openGlobePreview(g)}
                      player={player}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active games */}
            {active.length > 0 && (
              <div>
                <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-3">
                  In Progress — Spectate
                </h2>
                <div className="flex flex-col gap-4">
                  {active.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      territories={mapCache[g.map_id]?.territories ?? null}
                      onPreviewGlobe={() => openGlobePreview(g)}
                      player={player}
                    />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Globe size={48} className="mx-auto text-crusader-gold/20 mb-4" />
                <p className="text-crusader-gold/40 font-cinzel">No games found</p>
                <Button className="mt-6" onClick={() => setShowCreate(true)} icon={<Plus size={16} />}>
                  Create the First One
                </Button>
              </div>
            ) : (
              hasMore && !search && (
                <div className="pt-8 flex justify-center">
                  <Button 
                    variant="ghost" 
                    onClick={handleLoadMore} 
                    loading={loadingMore}
                    className="font-cinzel tracking-widest px-8"
                  >
                    {loadingMore ? 'Forging more games…' : 'Forge More Games'}
                  </Button>
                </div>
              )
            )}
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Quick start */}
            <Card className="p-6">
              <h3 className="font-cinzel text-base font-semibold text-crusader-gold mb-4">Quick Start</h3>
              <div className="flex flex-col gap-3">
                <Button fullWidth variant="gold" icon={<Zap size={16} />} onClick={() => setShowCreate(true)}>
                  ⚡ Lightning Game
                </Button>
                <Button fullWidth variant="outline" icon={<Shield size={16} />} onClick={() => setShowCreate(true)}>
                  vs AI Bot
                </Button>
              </div>
            </Card>

            {/* Featured Maps */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-cinzel text-base font-semibold text-crusader-gold">Featured Maps</h3>
                <Link href="/maps" className="text-xs text-crusader-gold/40 hover:text-crusader-gold">View all</Link>
              </div>
              <div className="space-y-3">
                {featuredMaps.map((map) => (
                  <div key={map.id} className="flex items-center justify-between py-2 border-b border-crusader-gold/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-crusader-gold-light/80">{map.name}</p>
                      <p className="text-xs text-crusader-gold/40 mt-0.5">{map.territories}t · ⭐ {map.rating}</p>
                    </div>
                    <span className="text-xs text-crusader-gold/30">{map.plays} plays</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Create map CTA */}
            <Card className="p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-crusader-gold/5 rounded-bl-full" />
              <Map size={24} className="text-crusader-gold mb-3" />
              <h3 className="font-cinzel text-base font-semibold text-crusader-gold mb-2">Create Your Map</h3>
              <p className="text-sm text-crusader-gold/50 mb-4 leading-relaxed">
                Design a custom battlefield — from a single country to the entire globe.
              </p>
              <Link href="/map-creator">
                <Button fullWidth variant="gold" size="sm" icon={<PenTool size={13} />}>
                  Open Map Creator
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </main>

      <CreateGameModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initialMapId={newMapId}
        initialMode={presetMode}
        initialMaxPlayers={presetPlayers}
        initialAiCount={presetAi}
      />

      <Modal
        open={previewGlobe !== null}
        onClose={() => setPreviewGlobe(null)}
        title={previewGlobe ? `Region: ${previewGlobe.regionName}` : 'Map Preview'}
        size="lg"
      >
        <div className="w-full h-[400px] sm:h-[500px] overflow-hidden rounded-xl bg-crusader-void border border-crusader-gold/20 relative">
          {previewGlobe && (
            <EarthGlobe
              interactive={true}
              autoRotate={false}
              selectionMode="none"
              selectedIds={previewGlobe.selectedIds}
              territories={previewGlobe.territories}
              focusLatLon={previewGlobe.focusLatLon}
              className="absolute inset-0 w-full h-full"
            />
          )}
          <div className="absolute top-4 right-4 pointer-events-none">
            <div className="glass px-3 py-1.5 rounded-full border border-crusader-gold/20 flex items-center gap-2">
              <Globe size={14} className="text-crusader-gold" />
              <span className="text-xs font-cinzel text-crusader-gold tracking-widest">INTERACTIVE 3D GLOBE</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
