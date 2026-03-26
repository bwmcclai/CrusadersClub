'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import { getSupabaseClient } from '@/lib/supabase'
import TerritoryMap from '@/components/three/TerritoryMap'
import Button from '@/components/ui/Button'
import { Map, Plus, Globe, Sword, Star, Layers, X, Search, ExternalLink } from 'lucide-react'
import type { Territory, BonusGroup } from '@/types'

// Dynamic import — Three.js must not run on server
const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-crusader-void/50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
        <p className="text-crusader-gold/40 font-cinzel text-xs tracking-widest">Loading Globe…</p>
      </div>
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapRecord {
  id: string
  name: string
  description?: string
  region_name: string
  region_bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  territories: Territory[]
  bonus_groups: BonusGroup[]
  play_count: number
  created_at: string
  author_id: string
  players?: { username: string }[] | { username: string } | null
}

// ─── Map Card ─────────────────────────────────────────────────────────────────

function MapCard({ map, index, onClick }: { map: MapRecord; index: number; onClick: () => void }) {
  const territoryCount = Array.isArray(map.territories) ? map.territories.length : 0
  const bonusGroupCount = Array.isArray(map.bonus_groups) ? map.bonus_groups.length : 0
  const playersData = map.players
  const authorName = Array.isArray(playersData) ? (playersData[0]?.username ?? 'Unknown') : ((playersData as any)?.username ?? 'Unknown')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5) }}
      onClick={onClick}
      className="cursor-pointer group relative bg-crusader-void/80 border border-crusader-gold/20 hover:border-crusader-gold/60 rounded-sm overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_8px_40px_rgba(201,168,76,0.2)] transition-all duration-300 hover:-translate-y-1"
    >
      {/* Map Preview */}
      <div className="relative h-44 bg-crusader-dark/50 overflow-hidden border-b border-crusader-gold/10">
        {territoryCount > 0 ? (
          <div className="w-full h-full opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <TerritoryMap territories={map.territories} className="w-full h-full" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-crusader-gold/20">
            <Map size={40} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-crusader-void/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <span className="font-cinzel text-sm font-bold text-crusader-gold tracking-widest uppercase flex items-center gap-2">
            <Globe size={16} /> View Map
          </span>
        </div>

        {/* Region badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-bold font-cinzel tracking-widest uppercase px-2 py-0.5 bg-black/70 border border-crusader-gold/30 text-crusader-gold/80 rounded-sm">
            {map.region_name}
          </span>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-cinzel text-base font-bold text-crusader-parchment group-hover:text-crusader-gold transition-colors truncate leading-tight flex-1">
            {map.name}
          </h3>
          <Link
            href={`/maps/${map.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-crusader-gold/30 hover:text-crusader-gold transition-colors ml-1 mt-0.5"
            title="Open full page"
          >
            <ExternalLink size={12} />
          </Link>
        </div>
        {map.description && (
          <p className="text-xs text-crusader-gold/50 mt-1 line-clamp-2 leading-relaxed">{map.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-crusader-gold/10">
          <div className="flex items-center gap-1.5 text-[11px] text-crusader-gold/60">
            <Layers size={11} />
            <span>{territoryCount} territories</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-crusader-gold/60">
            <Sword size={11} />
            <span>{map.play_count ?? 0} plays</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-crusader-gold/60">
            <Star size={11} />
            <span>{bonusGroupCount} groups</span>
          </div>
        </div>

        {/* Author + Date */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-crusader-gold/5">
          <span className="text-[10px] text-crusader-gold/40 font-cinzel truncate">{authorName}</span>
          <span className="text-[10px] text-crusader-gold/30 flex-shrink-0 ml-2">
            {new Date(map.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Map Detail Modal ─────────────────────────────────────────────────────────

function MapModal({ map, onClose }: { map: MapRecord; onClose: () => void }) {
  const [showGlobe, setShowGlobe] = useState(false)
  const territoryCount = Array.isArray(map.territories) ? map.territories.length : 0
  const bonusGroups = Array.isArray(map.bonus_groups) ? map.bonus_groups : []
  const playersData = map.players
  const authorName = Array.isArray(playersData) ? (playersData[0]?.username ?? 'Unknown') : ((playersData as any)?.username ?? 'Unknown')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] bg-crusader-void border border-crusader-gold/30 rounded-sm overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.95)]"
      >
        {/* Gold top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crusader-gold/80 to-transparent z-10" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-crusader-gold/50 hover:text-crusader-gold transition-colors hover:bg-crusader-gold/10 rounded"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col lg:flex-row max-h-[90vh] overflow-hidden">

          {/* Left: Preview (map or globe) */}
          <div className="lg:flex-1 relative bg-crusader-dark/50 min-h-[280px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-crusader-gold/10 overflow-hidden">

            {/* Toggle tabs */}
            <div className="absolute top-3 left-3 z-10 flex gap-1">
              <button
                onClick={() => setShowGlobe(false)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-cinzel font-bold tracking-widest uppercase rounded-sm border transition-all ${
                  !showGlobe
                    ? 'bg-crusader-gold/20 border-crusader-gold/60 text-crusader-gold'
                    : 'bg-black/50 border-crusader-gold/20 text-crusader-gold/40 hover:text-crusader-gold/70'
                }`}
              >
                <Map size={10} /> Map
              </button>
              <button
                onClick={() => setShowGlobe(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-cinzel font-bold tracking-widest uppercase rounded-sm border transition-all ${
                  showGlobe
                    ? 'bg-crusader-gold/20 border-crusader-gold/60 text-crusader-gold'
                    : 'bg-black/50 border-crusader-gold/20 text-crusader-gold/40 hover:text-crusader-gold/70'
                }`}
              >
                <Globe size={10} /> Globe
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!showGlobe ? (
                <motion.div
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full pointer-events-none p-4 pt-12"
                >
                  {territoryCount > 0 ? (
                    <TerritoryMap territories={map.territories} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-crusader-gold/20">
                      <Map size={60} />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="globe"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full pt-10"
                >
                  <EarthGlobe selectionMode="none" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Region label */}
            <div className="absolute bottom-4 left-4 pointer-events-none">
              <span className="text-xs font-cinzel font-bold tracking-[0.2em] uppercase text-crusader-gold/70 bg-black/70 px-3 py-1 border border-crusader-gold/20 rounded-sm">
                {map.region_name}
              </span>
            </div>
          </div>

          {/* Right: Details panel */}
          <div className="lg:w-80 xl:w-96 flex flex-col overflow-y-auto p-6 gap-5">
            <div>
              <h2 className="font-cinzel text-2xl font-black text-crusader-parchment leading-tight pr-8">{map.name}</h2>
              {map.description && (
                <p className="text-sm text-crusader-gold/60 mt-2 leading-relaxed">{map.description}</p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Territories', value: territoryCount,      icon: Layers },
                { label: 'Plays',       value: map.play_count ?? 0, icon: Sword  },
                { label: 'Bonuses',     value: bonusGroups.length,  icon: Star   },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-crusader-dark/40 border border-crusader-gold/10 rounded-sm p-3 text-center">
                  <Icon size={13} className="text-crusader-gold/50 mx-auto mb-1" />
                  <div className="font-cinzel font-bold text-crusader-gold text-xl leading-none">{value}</div>
                  <div className="text-[9px] text-crusader-gold/40 uppercase tracking-widest mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Bonus Groups */}
            {bonusGroups.length > 0 && (
              <div>
                <h4 className="font-cinzel text-[10px] font-bold text-crusader-gold/50 uppercase tracking-widest mb-2">
                  Bonus Groups
                </h4>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {bonusGroups.map((bg) => (
                    <div
                      key={bg.id}
                      className="flex items-center justify-between text-xs px-3 py-2 bg-crusader-dark/40 border border-crusader-gold/10 rounded-sm"
                    >
                      <span className="text-crusader-parchment/80 font-cinzel truncate mr-2">{bg.name}</span>
                      <span className="text-crusader-gold font-bold flex-shrink-0">+{bg.bonus_armies} ⚔</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creator + Date */}
            <div className="flex items-center justify-between text-[11px] text-crusader-gold/40 pt-3 border-t border-crusader-gold/10">
              <span className="font-cinzel">By {authorName}</span>
              <span>
                {new Date(map.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
            </div>

            {/* CTA */}
            <div className="mt-auto pt-2">
              <Link href={`/lobby?mapId=${map.id}`}>
                <Button variant="gold" fullWidth icon={<Sword size={15} />} className="font-cinzel font-bold tracking-widest">
                  Play on This Map
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapsPage() {
  const [maps, setMaps]           = useState<MapRecord[]>([])
  const [filtered, setFiltered]   = useState<MapRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedMap, setSelectedMap] = useState<MapRecord | null>(null)

  useEffect(() => {
    async function fetchMaps() {
      try {
        const { data } = await getSupabaseClient()
          .from('battle_maps')
          .select('id, name, description, region_name, region_bounds, territories, bonus_groups, play_count, created_at, author_id, players(username)')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
        if (data) {
          setMaps(data as unknown as MapRecord[])
          setFiltered(data as unknown as MapRecord[])
        }
      } catch (e) {
        console.error('Failed to fetch maps:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchMaps()
  }, [])

  // Search filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(maps)
    } else {
      const q = search.toLowerCase()
      setFiltered(
        maps.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.region_name.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q),
        ),
      )
    }
  }, [search, maps])

  return (
    <div className="min-h-screen bg-crusader-void text-crusader-parchment">
      <Navbar />

      {/* Background subtle pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

      <div className="relative pt-20 pb-16">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Map size={22} className="text-crusader-gold" />
                <h1 className="font-cinzel text-3xl sm:text-4xl font-black text-crusader-parchment tracking-wide">
                  Maps
                </h1>
              </div>
              <p className="text-crusader-gold/40 text-sm font-cinzel tracking-wider">
                {loading
                  ? 'Loading battle maps…'
                  : maps.length > 0
                  ? `${maps.length} battle map${maps.length !== 1 ? 's' : ''} forged for the realm`
                  : 'No maps yet — be the first to forge one'}
              </p>
            </div>

            <Link href="/map-creator" className="flex-shrink-0">
              <Button variant="gold" icon={<Plus size={16} />} className="font-cinzel font-bold tracking-widest">
                Create a Map
              </Button>
            </Link>
          </div>

          {/* Search bar */}
          {maps.length > 0 && (
            <div className="mt-5 relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-crusader-gold/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search maps, regions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-crusader-dark/50 border border-crusader-gold/20 focus:border-crusader-gold/60 outline-none text-sm font-cinzel text-crusader-parchment placeholder:text-crusader-gold/30 rounded-sm transition-colors"
              />
            </div>
          )}
        </div>

        {/* Gold divider */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-crusader-gold/30 to-transparent" />
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            // Skeleton grid
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 bg-crusader-dark/30 border border-crusader-gold/10 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <Map size={48} className="text-crusader-gold/20" />
              <div className="text-center">
                {search ? (
                  <>
                    <p className="font-cinzel text-xl text-crusader-gold/40">No maps found</p>
                    <p className="text-crusader-gold/30 text-sm mt-1">Try a different search term.</p>
                  </>
                ) : (
                  <>
                    <p className="font-cinzel text-xl text-crusader-gold/40">No Maps Yet</p>
                    <p className="text-crusader-gold/30 text-sm mt-1">Be the first to forge a battle map for the realm.</p>
                  </>
                )}
              </div>
              {!search && (
                <Link href="/map-creator">
                  <Button variant="gold" icon={<Plus size={16} />} className="font-cinzel font-bold tracking-widest">
                    Create First Map
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((map, index) => (
                <MapCard key={map.id} map={map} index={index} onClick={() => setSelectedMap(map)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Map Detail Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMap && (
          <MapModal map={selectedMap} onClose={() => setSelectedMap(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
