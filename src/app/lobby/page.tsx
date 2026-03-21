'use client'
import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { Sword, Map, Users, Zap, Shield, Clock, Search, Plus, Filter, Bot, Globe } from 'lucide-react'
import { formatMode } from '@/lib/utils'
import type { LobbyGame, GameMode } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_GAMES: LobbyGame[] = [
  { id: '1', name: 'Western Front',      mode: 'lightning',  status: 'waiting', max_players: 4, current_players: 2, map_name: 'Europe Classic',    creator_name: 'IronFist',    has_ai: false, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: '2', name: 'Pacific Storm',      mode: 'slow_day',   status: 'waiting', max_players: 6, current_players: 3, map_name: 'Pacific Islands',   creator_name: 'SeaWolf',     has_ai: true,  created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '3', name: 'Clash at Rhine',     mode: 'lightning',  status: 'waiting', max_players: 3, current_players: 1, map_name: 'Rhine Valley',      creator_name: 'Baron',       has_ai: false, created_at: new Date(Date.now() - 30000).toISOString()  },
  { id: '4', name: 'Desert Conquest',    mode: 'slow_hour',  status: 'active',  max_players: 4, current_players: 4, map_name: 'Africa Sands',      creator_name: 'SandStorm',   has_ai: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '5', name: 'Nordic Campaign',    mode: 'slow_day',   status: 'waiting', max_players: 5, current_players: 2, map_name: 'Nordic Fjords',     creator_name: 'Valhalla',    has_ai: true,  created_at: new Date(Date.now() - 900000).toISOString()  },
  { id: '6', name: 'Island Hopping',     mode: 'lightning',  status: 'waiting', max_players: 6, current_players: 4, map_name: 'Caribbean',         creator_name: 'Corsair',     has_ai: false, created_at: new Date(Date.now() - 200000).toISOString()  },
]

const MOCK_FEATURED_MAPS = [
  { id: 'm1', name: 'Europe Classic',   territories: 42, rating: 4.8, plays: 2100 },
  { id: 'm2', name: 'Pacific Islands',  territories: 28, rating: 4.5, plays: 1450 },
  { id: 'm3', name: 'Africa Sands',     territories: 35, rating: 4.7, plays: 980  },
  { id: 'm4', name: 'Rhine Valley',     territories: 12, rating: 4.6, plays: 540  },
]

// ─── Components ──────────────────────────────────────────────────────────────

function GameCard({ game }: { game: LobbyGame }) {
  const isFull = game.current_players >= game.max_players
  const fill   = game.current_players / game.max_players

  return (
    <Card hover glow={isFull ? 'none' : 'gold'} className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
              ${game.mode === 'lightning' ? 'border-crusader-gold/30 text-crusader-gold bg-crusader-gold/10' : 'border-crusader-glow/30 text-crusader-glow bg-crusader-glow/10'}`}>
              {game.mode === 'lightning' ? '⚡' : game.mode === 'slow_hour' ? '⏱' : '📅'}{' '}
              {game.mode === 'lightning' ? 'Lightning' : game.mode === 'slow_hour' ? '1hr/turn' : '1day/turn'}
            </span>
            {game.status === 'active' && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/10 font-medium">
                In Progress
              </span>
            )}
            {game.has_ai && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-crusader-steel/40 text-crusader-gold/60 bg-crusader-steel/20">
                <Bot size={10} className="inline mr-1" />AI
              </span>
            )}
          </div>
          <h3 className="font-cinzel font-semibold text-crusader-gold-light truncate">{game.name}</h3>
        </div>
        <Link href={`/game/${game.id}`}>
          <Button
            size="sm"
            variant={isFull ? 'ghost' : 'gold'}
            disabled={isFull && game.status === 'active'}
          >
            {game.status === 'active' ? 'Watch' : isFull ? 'Full' : 'Join'}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 text-xs text-crusader-gold/40 mb-3">
        <span className="flex items-center gap-1"><Map size={11} /> {game.map_name}</span>
        <span className="flex items-center gap-1 text-crusader-gold/30">by {game.creator_name}</span>
      </div>

      {/* Player slots */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {Array.from({ length: game.max_players }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                i < game.current_players ? 'bg-crusader-gold' : 'bg-crusader-gold/10'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-crusader-gold/50 whitespace-nowrap">
          <Users size={10} className="inline mr-1" />
          {game.current_players}/{game.max_players}
        </span>
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

function CreateGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<CreateGameForm>({
    name: '', mode: 'lightning', maxPlayers: 4, mapId: '', aiCount: 0,
  })
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    // TODO: Supabase create game
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
          <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">Select Map</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto scrollbar-none">
            {MOCK_FEATURED_MAPS.map((map) => (
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
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">
              Max Players: <span className="text-crusader-gold">{form.maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={6} value={form.maxPlayers}
              onChange={(e) => setForm((f) => ({ ...f, maxPlayers: Number(e.target.value) }))}
              className="w-full accent-crusader-gold"
            />
          </div>
          <div>
            <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">
              AI Bots: <span className="text-crusader-gold">{form.aiCount}</span>
            </label>
            <input
              type="range" min={0} max={Math.min(form.maxPlayers - 1, 5)} value={form.aiCount}
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
  const [search, setSearch]       = useState('')
  const [modeFilter, setModeFilter] = useState<GameMode | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = MOCK_GAMES.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.map_name.toLowerCase().includes(search.toLowerCase())
    const matchMode   = modeFilter === 'all' || g.mode === modeFilter
    return matchSearch && matchMode
  })

  const waiting = filtered.filter((g) => g.status === 'waiting')
  const active  = filtered.filter((g) => g.status === 'active')

  return (
    <div className="min-h-screen bg-crusader-void">
      <Navbar />

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
                <div className="grid sm:grid-cols-2 gap-4">
                  {waiting.map((g) => <GameCard key={g.id} game={g} />)}
                </div>
              </div>
            )}

            {/* Active games */}
            {active.length > 0 && (
              <div>
                <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-3">
                  In Progress — Spectate
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {active.map((g) => <GameCard key={g.id} game={g} />)}
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
                {MOCK_FEATURED_MAPS.map((map) => (
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
              <h3 className="font-cinzel text-base font-semibold text-crusader-gold mb-2">Create a Map</h3>
              <p className="text-sm text-crusader-gold/50 mb-4 leading-relaxed">
                Build your own battle map from any region on Earth.
              </p>
              <Link href="/map-creator">
                <Button fullWidth variant="outline" size="sm">Open Map Creator</Button>
              </Link>
            </Card>
          </div>
        </div>
      </main>

      <CreateGameModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
