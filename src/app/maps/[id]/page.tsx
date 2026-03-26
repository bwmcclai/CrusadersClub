'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getSupabaseClient } from '@/lib/supabase'
import TerritoryMap from '@/components/three/TerritoryMap'
import Button from '@/components/ui/Button'
import { Map, Globe, Sword, Star, Layers, ChevronLeft } from 'lucide-react'
import type { Territory, BonusGroup } from '@/types'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-crusader-void/50">
      <div className="w-10 h-10 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
    </div>
  ),
})

interface MapRecord {
  id: string
  name: string
  description?: string
  region_name: string
  territories: Territory[]
  bonus_groups: BonusGroup[]
  play_count: number
  created_at: string
  author_id: string
  players?: { username: string }[] | { username: string } | null
}

export default function MapDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [map, setMap]           = useState<MapRecord | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    async function fetchMap() {
      const { data } = await getSupabaseClient()
        .from('battle_maps')
        .select('id, name, description, region_name, territories, bonus_groups, play_count, created_at, author_id, players(username)')
        .eq('id', id)
        .maybeSingle()
      setMap(data as MapRecord | null)
      setLoading(false)
    }
    if (id) fetchMap()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-crusader-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
          <p className="font-cinzel text-crusader-gold/50 text-sm tracking-widest">Loading Map…</p>
        </div>
      </div>
    )
  }

  if (!map) {
    return (
      <div className="min-h-screen bg-crusader-void flex flex-col items-center justify-center gap-6">
        <Map size={48} className="text-crusader-gold/20" />
        <p className="font-cinzel text-xl text-crusader-gold/40">Map not found</p>
        <Link href="/maps">
          <Button variant="ghost" icon={<ChevronLeft size={16} />} className="font-cinzel">Back to Maps</Button>
        </Link>
      </div>
    )
  }

  const territoryCount = Array.isArray(map.territories) ? map.territories.length : 0
  const bonusGroups    = Array.isArray(map.bonus_groups) ? map.bonus_groups : []
  const playersData    = map.players
  const authorName     = Array.isArray(playersData) ? (playersData[0]?.username ?? 'Unknown') : ((playersData as any)?.username ?? 'Unknown')

  return (
    <div className="min-h-screen bg-crusader-void text-crusader-parchment">

      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

      <div className="relative pt-20 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="py-5"
        >
          <Link href="/maps" className="flex items-center gap-2 text-crusader-gold/50 hover:text-crusader-gold transition-colors font-cinzel text-sm tracking-wider">
            <ChevronLeft size={16} /> All Maps
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] gap-0 border border-crusader-gold/25 rounded-sm overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.7)]"
        >
          {/* Left: Visualisation */}
          <div className="relative bg-crusader-dark/60 min-h-[400px] lg:min-h-[600px] border-b lg:border-b-0 lg:border-r border-crusader-gold/10 overflow-hidden">
            {/* Gold top accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crusader-gold/60 to-transparent z-10" />

            {/* View toggle */}
            <div className="absolute top-4 left-4 z-10 flex gap-1.5">
              <button
                onClick={() => setShowGlobe(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-cinzel font-bold tracking-widest uppercase rounded-sm border transition-all ${
                  !showGlobe
                    ? 'bg-crusader-gold/20 border-crusader-gold/60 text-crusader-gold'
                    : 'bg-black/50 border-crusader-gold/20 text-crusader-gold/40 hover:text-crusader-gold/70'
                }`}
              >
                <Map size={10} /> Territory Map
              </button>
              <button
                onClick={() => setShowGlobe(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-cinzel font-bold tracking-widest uppercase rounded-sm border transition-all ${
                  showGlobe
                    ? 'bg-crusader-gold/20 border-crusader-gold/60 text-crusader-gold'
                    : 'bg-black/50 border-crusader-gold/20 text-crusader-gold/40 hover:text-crusader-gold/70'
                }`}
              >
                <Globe size={10} /> Globe View
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!showGlobe ? (
                <motion.div
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full pointer-events-none p-6 pt-14"
                >
                  {territoryCount > 0 ? (
                    <TerritoryMap territories={map.territories} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-crusader-gold/20">
                      <Map size={80} />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="globe"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full pt-12"
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

          {/* Right: Info panel */}
          <div className="flex flex-col p-6 gap-5 bg-crusader-void">
            {/* Title */}
            <div>
              <h1 className="font-cinzel text-3xl font-black text-crusader-parchment leading-tight">{map.name}</h1>
              {map.description && (
                <p className="text-sm text-crusader-gold/60 mt-2 leading-relaxed">{map.description}</p>
              )}
            </div>

            <div className="h-[1px] bg-gradient-to-r from-crusader-gold/20 to-transparent" />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Territories', value: territoryCount,      icon: Layers },
                { label: 'Plays',       value: map.play_count ?? 0, icon: Sword  },
                { label: 'Bonuses',     value: bonusGroups.length,  icon: Star   },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-crusader-dark/40 border border-crusader-gold/10 rounded-sm p-3 text-center">
                  <Icon size={14} className="text-crusader-gold/50 mx-auto mb-1" />
                  <div className="font-cinzel font-bold text-crusader-gold text-2xl leading-none">{value}</div>
                  <div className="text-[9px] text-crusader-gold/40 uppercase tracking-widest mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Bonus Groups */}
            {bonusGroups.length > 0 && (
              <div>
                <h3 className="font-cinzel text-[10px] font-bold text-crusader-gold/50 uppercase tracking-widest mb-2">
                  Bonus Groups
                </h3>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {bonusGroups.map((bg) => (
                    <div
                      key={bg.id}
                      className="flex items-center justify-between text-sm px-3 py-2.5 bg-crusader-dark/40 border border-crusader-gold/10 rounded-sm"
                    >
                      <span className="text-crusader-parchment/80 font-cinzel truncate mr-3">{bg.name}</span>
                      <span className="text-crusader-gold font-bold flex-shrink-0">+{bg.bonus_armies} ⚔</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-crusader-gold/40 pt-3 border-t border-crusader-gold/10 mt-auto">
              <span className="font-cinzel">By {authorName}</span>
              <span>
                {new Date(map.created_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            </div>

            {/* CTA */}
            <Link href={`/lobby?mapId=${map.id}`}>
              <Button variant="gold" fullWidth icon={<Sword size={16} />} className="font-cinzel font-bold tracking-[0.15em] py-4">
                Play on This Map
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
