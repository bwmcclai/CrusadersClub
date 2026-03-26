'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { Sword, Map, Users, Zap, Shield, Clock, Search, Plus, Filter, Bot, Globe, PenTool } from 'lucide-react'
import { formatMode } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase'
import type { LobbyGame, GameMode } from '@/types'
import TerritoryMap from '@/components/three/TerritoryMap'
import EarthGlobe from '@/components/three/EarthGlobe'

// ─── Data fetch utilities ─────────────────────────────────────────────────────

// ─── Components ──────────────────────────────────────────────────────────────

function GameCard({ 
  game, 
  previewTerritories,
  onPreviewGlobe 
}: { 
  game: LobbyGame, 
  previewTerritories: any[] | null,
  onPreviewGlobe: (regionName: string) => void
}) {
  const isFull = game.current_players >= game.max_players
  const fill   = game.current_players / game.max_players

  return (
    <Card hover glow={isFull ? 'none' : 'gold'} className="flex flex-col overflow-hidden p-0 relative group">
      {/* Thumbnail section */}
      <div 
        className="relative w-full h-44 flex-shrink-0 bg-crusader-dark/50 border-b border-crusader-gold/10 flex items-center justify-center p-3 cursor-pointer group/map"
        onClick={() => onPreviewGlobe(game.region_name)}
      >
        {previewTerritories ? (
           <TerritoryMap territories={previewTerritories} className="w-full h-full opacity-70 group-hover/map:opacity-100 transition-opacity drop-shadow-md pointer-events-none" />
        ) : (
           <div className="w-full h-full animate-pulse bg-crusader-gold/5 rounded" />
        )}
        
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
        
        {/* Hover Action */}
        <div className="absolute custom-backdrop-blur inset-0 bg-crusader-void/40 flex items-center justify-center opacity-0 group-hover/map:opacity-100 transition-opacity">
          <Button variant="gold" size="sm" icon={<Globe size={14} />} className="pointer-events-none shadow-glow-gold pointer-events-none">
            View on Globe
          </Button>
        </div>
        
        {/* Map Name */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-crusader-gold/90 drop-shadow-md">
            <Map size={12} /> {game.map_name}
          </div>
          {game.has_ai && (
            <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border border-crusader-steel/40 text-crusader-gold/60 bg-crusader-steel/20 shadow-md">
              <Bot size={10} className="inline mr-1" />AI
            </span>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-w-0 bg-gradient-to-br from-transparent to-crusader-gold/5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-cinzel text-lg font-bold text-crusader-parchment truncate leading-tight drop-shadow-sm">{game.name}</h3>
            <p className="text-xs text-crusader-gold/50 flex items-center gap-1.5 mt-1.5">
              <Shield size={12} className="text-crusader-gold/30" /> Hosted by {game.creator_name || 'System'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
             <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${game.mode === 'lightning' ? 'border-crusader-gold/30 text-crusader-gold bg-crusader-gold/10' : 'border-crusader-glow/30 text-crusader-glow bg-crusader-glow/10'}`}>
                {game.mode === 'lightning' ? '⚡ Light' : game.mode === 'slow_hour' ? '⏱ 1hr' : '📅 1day'}
              </span>
              {game.status === 'active' && (
                <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-green-500/30 text-green-400 bg-green-500/10 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                  In Progress
                </span>
              )}
          </div>
        </div>

        {/* Bottom row: Players */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-crusader-gold/10">
          <div className="flex items-center gap-2 flex-1 mr-4">
            <Users size={14} className="text-crusader-gold/50 flex-shrink-0" />
            <div className="flex gap-1 flex-1 max-w-[140px]">
              {Array.from({ length: game.max_players }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < game.current_players ? 'bg-crusader-gold shadow-glow-gold' : 'bg-crusader-dark border border-crusader-gold/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-cinzel font-bold text-crusader-gold/70 flex-shrink-0">
              {game.current_players}/{game.max_players}
            </span>
          </div>

          <div className="flex-shrink-0 text-right">
            <Link href={`/game/${game.id}`}>
              <Button
                size="sm"
                variant={isFull ? 'ghost' : 'gold'}
                disabled={isFull && game.status === 'active'}
                className="w-24 px-0 justify-center h-8 text-xs"
              >
                {game.status === 'active' ? 'Watch' : isFull ? 'Spectate' : 'Join'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
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

  async function handleCreate() {
    setLoading(true)
    // TODO: Supabase create game + redirect to game room
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    onClose()
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

export default function LobbyPage() {
  const searchParams   = useSearchParams()
  const [search, setSearch]           = useState('')
  const [modeFilter, setModeFilter]   = useState<GameMode | 'all'>('all')
  const [showCreate, setShowCreate]   = useState(false)
  const [mapPreviewData, setMapPreviewData] = useState<any[] | null>(null)
  const [games, setGames]             = useState<LobbyGame[]>([])
  const [featuredMaps, setFeaturedMaps] = useState<any[]>([])
  
  // Globe Preview Modal State
  const [previewRegion, setPreviewRegion] = useState<string | null>(null)

  // Map arbitrary region names back to lat/lon roughly
  const REGION_COORDS: Record<string, [number, number]> = {
    'Europe': [54, 15],
    'Africa': [5, 22],
    'Americas': [15, -90],
    'Pacific': [0, 160],
    'Asia': [45, 90],
    'Oceania': [-25, 140],
  }

  // Fetch games and featured maps
  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseClient()
      
      // Fetch lobby games
      const { data: gamesData } = await supabase
        .from('lobby_games')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (gamesData) {
        setGames(gamesData)
      }

      // Fetch featured maps for sidebar
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
          rating:      5.0, // Default mock rating
          plays:       m.play_count ?? 0,
        })))
      }
    }
    fetchData()
  }, [])

  // Pre-populate from Map Creator redirect (?newMapId=xxx&mode=...&maxPlayers=...&aiCount=...)
  const newMapId      = searchParams.get('newMapId')    ?? undefined
  const presetMode    = (searchParams.get('mode')       ?? undefined) as GameMode | undefined
  const presetPlayers = searchParams.get('maxPlayers')  ? Number(searchParams.get('maxPlayers'))  : undefined
  const presetAi      = searchParams.get('aiCount')     ? Number(searchParams.get('aiCount'))     : undefined

  useEffect(() => {
    if (newMapId) setShowCreate(true)
  }, [newMapId])

  // Fetch real map data from db to use for previews
  useEffect(() => {
    async function fetchMapPreview() {
      const { data } = await getSupabaseClient()
        .from('battle_maps')
        .select('territories')
        .limit(1)
        .single()
      if (data?.territories) {
        setMapPreviewData(typeof data.territories === 'string' ? JSON.parse(data.territories) : data.territories)
      }
    }
    fetchMapPreview()
  }, [])

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
          <Button icon={<Plus size={18} />} size="lg" onClick={() => setShowCreate(true)}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {waiting.map((g) => <GameCard key={g.id} game={g} previewTerritories={mapPreviewData} onPreviewGlobe={setPreviewRegion} />)}
                </div>
              </div>
            )}

            {/* Active games */}
            {active.length > 0 && (
              <div>
                <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-3">
                  In Progress — Spectate
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {active.map((g) => <GameCard key={g.id} game={g} previewTerritories={mapPreviewData} onPreviewGlobe={setPreviewRegion} />)}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <Globe size={48} className="mx-auto text-crusader-gold/20 mb-4" />
                <p className="text-crusader-gold/40 font-cinzel">No games found</p>
                <Button className="mt-6" onClick={() => setShowCreate(true)} icon={<Plus size={16} />}>
                  Create the First One
                </Button>
              </div>
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

      <Modal open={previewRegion !== null} onClose={() => setPreviewRegion(null)} title={previewRegion ? `Region: ${previewRegion}` : 'Map Preview'} size="lg">
        <div className="w-full h-[400px] sm:h-[500px] overflow-hidden rounded-xl bg-crusader-void border border-crusader-gold/20 relative">
           <EarthGlobe 
             interactive={true} 
             autoRotate={false} 
             focusLatLon={previewRegion && REGION_COORDS[previewRegion] ? REGION_COORDS[previewRegion] : undefined}
           />
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
