'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import TerritoryMap from '@/components/three/TerritoryMap'
import { generateZonesFromFeatures } from '@/lib/utils'
import {
  type ContinentId, getCountryName, getContinentCountryIds,
  CONTINENT_INFO, CONTINENT_COUNTRIES,
} from '@/lib/geoData'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { Territory, BonusGroup, GameMode } from '@/types'
import {
  Globe, Map, Layers, ChevronRight, ChevronLeft,
  Shuffle, Save, CheckCircle, Plus, Sword, Info,
  Users, Zap, Clock, Calendar, Settings, Eye, EyeOff,
  Edit3, X, AlertTriangle,
} from 'lucide-react'

// ─── Dynamic import (Three.js SSR guard) ──────────────────────────────────────

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-crusader-void">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
        <p className="text-crusader-gold/60 font-cinzel text-sm tracking-widest">Loading Globe...</p>
      </div>
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Step     = 'type' | 'select' | 'configure' | 'preview' | 'save'
type MapType  = 'globe' | 'continent' | 'countries'
type SpoilsMode = 'fixed' | 'progressive' | 'none'
type InitDeploy = 'auto' | 'manual'

interface GameConfig {
  mapName:     string
  mapDesc:     string
  gameMode:    GameMode
  maxPlayers:  number
  aiCount:     number
  spoilsMode:  SpoilsMode
  fogOfWar:    boolean
  teamMode:    boolean
  initDeploy:  InitDeploy
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string; icon: typeof Globe }[] = [
  { id: 'type',      label: 'Map Type',      icon: Globe    },
  { id: 'select',    label: 'Select Region', icon: Map      },
  { id: 'configure', label: 'Configure',     icon: Settings },
  { id: 'preview',   label: 'Preview',       icon: Layers   },
  { id: 'save',      label: 'Publish',       icon: Save     },
]

// ─── Map Type Cards ───────────────────────────────────────────────────────────

const MAP_TYPES: {
  id:    MapType
  icon:  typeof Globe
  label: string
  sub:   string
  desc:  string
  zones: string
}[] = [
  {
    id:    'globe',
    icon:  Globe,
    label: 'Entire Globe',
    sub:   'World domination',
    desc:  'All countries on Earth become territories, grouped by continent. The classic grand strategy experience.',
    zones: '~190 territories · 6 continents',
  },
  {
    id:    'continent',
    icon:  Map,
    label: 'Continent',
    sub:   'Regional warfare',
    desc:  'Click a continent on the globe. Every country within it becomes its own territory.',
    zones: '5–55 territories · 1 bonus group',
  },
  {
    id:    'countries',
    icon:  Layers,
    label: 'Custom Countries',
    sub:   'Hand-crafted arena',
    desc:  'Multi-select any countries you want. The combined territory is carved into playable zones via Voronoi tessellation.',
    zones: 'You control the count',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRegionBounds(features: GeoJSON.Feature[]) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const feat of features) {
    const geo = feat.geometry
    if (!geo) continue
    const coords: number[][][] =
      geo.type === 'Polygon'      ? geo.coordinates as number[][][] :
      geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() :
      []
    for (const ring of coords) {
      for (const [lon, lat] of ring) {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
      }
    }
  }
  return { minLat, maxLat, minLon, maxLon }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapCreatorPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const player       = useAppStore((s) => s.player)

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step,    setStep]    = useState<Step>('type')
  const [mapType, setMapType] = useState<MapType | null>(null)

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selContinent, setSelContinent]         = useState<ContinentId | null>(null)
  const [selContinentFeats, setSelContinentFeats] = useState<GeoJSON.Feature[]>([])
  const [selCountryIds, setSelCountryIds]       = useState<number[]>([])
  const [selCountryFeats, setSelCountryFeats]   = useState<GeoJSON.Feature[]>([])

  // ── Config state ────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<GameConfig>({
    mapName:    '',
    mapDesc:    '',
    gameMode:   'lightning',
    maxPlayers: 4,
    aiCount:    0,
    spoilsMode: 'fixed',
    fogOfWar:   false,
    teamMode:   false,
    initDeploy: 'auto',
  })

  // ── Output state ─────────────────────────────────────────────────────────────
  const [territories, setTerritories] = useState<Territory[]>([])
  const [bonusGroups, setBonusGroups] = useState<BonusGroup[]>([])
  const [tCount,      setTCount]      = useState(12)
  const [generating,  setGenerating]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [savedId,     setSavedId]     = useState<string | null>(null)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editName,    setEditName]    = useState('')

  // ── Step index for progress bar ─────────────────────────────────────────────
  const visibleSteps = useMemo(() => {
    return mapType === 'globe'
      ? STEPS.filter((s) => s.id !== 'select')
      : STEPS
  }, [mapType])

  const currentIdx = visibleSteps.findIndex((s) => s.id === step)

  // ── Continent selection (continent mode) ────────────────────────────────────
  const handleContinentSelect = useCallback((
    continent: ContinentId,
    countryIds: number[],
    features: GeoJSON.Feature[],
  ) => {
    setSelContinent(continent)
    setSelContinentFeats(features)
    setConfig((c) => ({ ...c, mapName: `${CONTINENT_INFO[continent].label} — ${new Date().getFullYear()}` }))
  }, [])

  // ── Country toggle (countries mode) ─────────────────────────────────────────
  const handleCountryToggle = useCallback((id: number, name: string, feat: GeoJSON.Feature) => {
    setSelCountryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
    setSelCountryFeats((prev) => {
      const exists = prev.some((f) => {
        const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
        return fid === id
      })
      if (exists) return prev.filter((f) => {
        const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
        return fid !== id
      })
      return [...prev, feat]
    })
  }, [])

  const removeCountry = useCallback((id: number) => {
    setSelCountryIds((p) => p.filter((x) => x !== id))
    setSelCountryFeats((p) => p.filter((f) => {
      const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
      return fid !== id
    }))
  }, [])

  // ── Map type selection ──────────────────────────────────────────────────────
  function handleMapTypeSelect(type: MapType) {
    setMapType(type)
    if (type === 'globe') {
      setConfig((c) => ({ ...c, mapName: `World — ${new Date().getFullYear()}` }))
      setStep('configure')
    } else {
      setStep('select')
    }
  }

  // ── Advance from Select step ────────────────────────────────────────────────
  function continueFromSelect() {
    setStep('configure')
  }

  // ── Zone generation ─────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 50))

    try {
      if (mapType === 'globe') {
        // Fetch all country features and generate zones
        const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
        const topology = await resp.json()
        const { feature } = await import('topojson-client')
        const { getContinentCountryIds: getCids } = await import('@/lib/geoData')
        const countries = feature(topology, topology.objects.countries) as unknown as GeoJSON.FeatureCollection
        const allFeatures = countries.features as GeoJSON.Feature[]

        const bonusDefs = (Object.entries(CONTINENT_COUNTRIES) as [ContinentId, number[]][]).map(
          ([cid, ids]) => ({
            id:         `bonus-${cid}`,
            name:       CONTINENT_INFO[cid].label,
            featureIds: ids,
            bonus:      Math.max(2, Math.round(ids.length / 3)),
          })
        )

        const result = generateZonesFromFeatures(allFeatures, bonusDefs)
        // Assign territory names from country names
        const named = result.territories.map((t) => {
          const iso = parseInt(t.id.replace('z-', ''))
          return { ...t, name: getCountryName(iso) }
        })
        setTerritories(named)
        setBonusGroups(result.bonusGroups)

      } else if (mapType === 'continent' && selContinentFeats.length > 0) {
        const cid = selContinent!
        const bonusDefs = [{
          id:         `bonus-${cid}`,
          name:       CONTINENT_INFO[cid].label,
          featureIds: getContinentCountryIds(cid),
          bonus:      Math.max(3, Math.round(selContinentFeats.length / 4)),
        }]
        const result = generateZonesFromFeatures(selContinentFeats, bonusDefs)
        const named = result.territories.map((t) => {
          const iso = parseInt(t.id.replace('z-', ''))
          return { ...t, name: getCountryName(iso) }
        })
        setTerritories(named)
        setBonusGroups(result.bonusGroups)

      } else if (mapType === 'countries' && selCountryFeats.length > 0) {
        // Each selected country = one territory; adjacency via Delaunay of centroids
        const bonusDefs = [{
          id:         'bonus-custom',
          name:       'Combined Region',
          featureIds: selCountryIds,
          bonus:      Math.max(2, Math.round(selCountryIds.length / 3)),
        }]
        const result = generateZonesFromFeatures(selCountryFeats, bonusDefs)
        const named = result.territories.map((t) => {
          const iso = parseInt(t.id.replace('z-', ''))
          return { ...t, name: getCountryName(iso) }
        })
        setTerritories(named)
        setBonusGroups(result.bonusGroups)
      }

      setStep('preview')
    } finally {
      setGenerating(false)
    }
  }

  // ── Rename territory ───────────────────────────────────────────────────────
  function commitRename() {
    if (!editingId) return
    setTerritories((ts) => ts.map((t) => t.id === editingId ? { ...t, name: editName } : t))
    setEditingId(null)
  }

  // ── Save map + game settings ────────────────────────────────────────────────
  async function handleSave() {
    if (!player) return
    setSaving(true)
    try {
      const allFeatures =
        mapType === 'continent' ? selContinentFeats :
        mapType === 'countries' ? selCountryFeats   : []

      const bounds = allFeatures.length > 0
        ? computeRegionBounds(allFeatures)
        : { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 }

      const regionName =
        mapType === 'globe'     ? 'Entire Globe' :
        mapType === 'continent' ? CONTINENT_INFO[selContinent!].label :
        selCountryIds.map(getCountryName).join(', ')

      const sb = getSupabaseClient()
      const { data, error } = await sb.from('battle_maps').insert({
        name:          config.mapName,
        description:   config.mapDesc || null,
        author_id:     player.id,
        region_name:   regionName,
        region_bounds: bounds,
        territories,
        bonus_groups:  bonusGroups,
        is_public:     true,
      }).select('id').single()

      if (error) throw error

      setSavedId(data.id)
      setStep('save')
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Redirect to lobby with new map + game settings ──────────────────────────
  function playMap() {
    if (!savedId) return
    const params = new URLSearchParams({
      newMapId:   savedId,
      mode:       config.gameMode,
      maxPlayers: String(config.maxPlayers),
      aiCount:    String(config.aiCount),
    })
    router.push(`/lobby?${params.toString()}`)
  }

  function resetAll() {
    setStep('type'); setMapType(null)
    setSelContinent(null); setSelContinentFeats([])
    setSelCountryIds([]); setSelCountryFeats([])
    setTerritories([]); setBonusGroups([])
    setSavedId(null)
    setConfig((c) => ({ ...c, mapName: '', mapDesc: '' }))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const canContinueFromSelect =
    (mapType === 'continent' && selContinent !== null) ||
    (mapType === 'countries' && selCountryIds.length >= 2)

  return (
    <div className="min-h-screen bg-crusader-void flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16 flex flex-col">

        {/* ── Progress Bar ─────────────────────────────────────────────────── */}
        <div className="border-b border-crusader-gold/10 bg-crusader-dark/60 backdrop-blur-sm shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-1 sm:gap-3">
              {visibleSteps.map((s, i) => {
                const Icon     = s.icon
                const isActive = s.id === step
                const isPast   = i < currentIdx
                return (
                  <div key={s.id} className="flex items-center gap-1 sm:gap-3">
                    <button
                      disabled={!isPast && !isActive}
                      onClick={() => isPast && setStep(s.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-cinzel tracking-wide transition-all
                        ${isActive ? 'bg-crusader-gold/20 text-crusader-gold border border-crusader-gold/40' :
                          isPast   ? 'text-crusader-gold/50 cursor-pointer hover:text-crusader-gold' :
                                     'text-crusader-gold/20 cursor-not-allowed'}`}
                    >
                      {isPast ? <CheckCircle size={12} /> : <Icon size={12} />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                    {i < visibleSteps.length - 1 && (
                      <ChevronRight size={12} className="text-crusader-gold/15 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* STEP: TYPE SELECTION                                                */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === 'type' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center mb-10 animate-fade-in">
              <h1 className="font-cinzel text-4xl font-bold text-crusader-gold glow-gold mb-3">
                Map Creator
              </h1>
              <p className="text-crusader-gold/50 text-lg">
                What kind of battlefield will you forge?
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl animate-fade-in">
              {MAP_TYPES.map((mt) => {
                const Icon = mt.icon
                return (
                  <button
                    key={mt.id}
                    onClick={() => handleMapTypeSelect(mt.id)}
                    className="group relative p-6 rounded-2xl border border-crusader-gold/15 bg-crusader-dark/60 hover:border-crusader-gold/50 hover:bg-crusader-gold/5 transition-all duration-300 text-left hover:scale-[1.02]"
                  >
                    {/* Glow on hover */}
                    <div className="absolute inset-0 rounded-2xl bg-crusader-gold/0 group-hover:bg-crusader-gold/3 transition-all" />

                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-crusader-gold/10 border border-crusader-gold/20 flex items-center justify-center mb-4 group-hover:bg-crusader-gold/20 transition-all">
                        <Icon size={22} className="text-crusader-gold" />
                      </div>

                      <div className="text-xs font-medium text-crusader-gold/40 tracking-widest uppercase mb-1">
                        {mt.sub}
                      </div>
                      <h3 className="font-cinzel text-xl font-bold text-crusader-gold mb-2">
                        {mt.label}
                      </h3>
                      <p className="text-sm text-crusader-gold/50 leading-relaxed mb-4">
                        {mt.desc}
                      </p>
                      <div className="text-xs text-crusader-gold/30 bg-crusader-gold/5 border border-crusader-gold/10 rounded-lg px-3 py-1.5">
                        {mt.zones}
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="absolute top-6 right-6 text-crusader-gold/20 group-hover:text-crusader-gold/60 group-hover:translate-x-1 transition-all"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* STEP: SELECT REGION                                                 */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === 'select' && mapType !== 'globe' && (
          <div className="flex-1 flex flex-col lg:flex-row">

            {/* Globe (2/3) */}
            <div className="flex-1 lg:flex-[2] relative" style={{ minHeight: '55vh' }}>
              <EarthGlobe
                interactive
                autoRotate={
                  mapType === 'continent' ? selContinent === null :
                  selCountryIds.length === 0
                }
                selectionMode={mapType === 'continent' ? 'continent' : 'multi-country'}
                selectedIds={
                  mapType === 'continent'
                    ? (selContinent ? getContinentCountryIds(selContinent) : [])
                    : selCountryIds
                }
                onContinentSelect={mapType === 'continent' ? handleContinentSelect : undefined}
                onMultiCountryToggle={mapType === 'countries' ? handleCountryToggle : undefined}
                className="absolute inset-0 w-full h-full"
              />

              {/* Instruction overlay */}
              {!selContinent && mapType === 'continent' && selCountryIds.length === 0 && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="glass px-5 py-2.5 rounded-full border border-crusader-gold/20">
                    <p className="text-xs font-cinzel text-crusader-gold/80 tracking-widest">
                      {mapType === 'continent'
                        ? 'Click a continent on the globe'
                        : 'Click countries to select them'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar (1/3) */}
            <div className="lg:w-80 xl:w-96 flex flex-col border-l border-crusader-gold/10 bg-crusader-dark/40">

              {/* Back button */}
              <div className="p-4 border-b border-crusader-gold/10">
                <button
                  onClick={() => setStep('type')}
                  className="flex items-center gap-2 text-xs text-crusader-gold/40 hover:text-crusader-gold transition-colors"
                >
                  <ChevronLeft size={12} /> Back to Map Type
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {/* ── Continent mode ── */}
                {mapType === 'continent' && (
                  <div>
                    <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-4">
                      Continent Selection
                    </h2>

                    {selContinent ? (
                      <div className="animate-fade-in">
                        <div
                          className="w-full h-1.5 rounded-full mb-4"
                          style={{ background: CONTINENT_INFO[selContinent].color }}
                        />
                        <h3 className="font-cinzel text-2xl font-bold text-crusader-gold mb-1">
                          {CONTINENT_INFO[selContinent].label}
                        </h3>
                        <p className="text-sm text-crusader-gold/50 mb-5">
                          {getContinentCountryIds(selContinent).length} territories · each country is one zone
                        </p>

                        <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-none">
                          {getContinentCountryIds(selContinent).map((id) => (
                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-crusader-gold/5 border border-crusader-gold/10">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: CONTINENT_INFO[selContinent].color }}
                              />
                              <span className="text-xs text-crusader-gold/70">{getCountryName(id)}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => { setSelContinent(null); setSelContinentFeats([]) }}
                          className="mt-4 text-xs text-crusader-gold/30 hover:text-crusader-gold/60 flex items-center gap-1 transition-colors"
                        >
                          <X size={10} /> Choose different continent
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(Object.entries(CONTINENT_INFO) as [ContinentId, typeof CONTINENT_INFO[ContinentId]][]).map(([id, info]) => (
                          <div key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-crusader-gold/10 text-crusader-gold/30">
                            <div className="w-2 h-2 rounded-full" style={{ background: info.color + '60' }} />
                            <span className="text-sm font-cinzel">{info.label}</span>
                            <span className="text-xs ml-auto">{getContinentCountryIds(id).length} countries</span>
                          </div>
                        ))}
                        <p className="text-xs text-crusader-gold/30 text-center mt-3">
                          Click on the globe to select
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Countries mode ── */}
                {mapType === 'countries' && (
                  <div>
                    <h2 className="font-cinzel text-sm font-semibold text-crusader-gold/60 tracking-widest uppercase mb-4">
                      Selected Countries ({selCountryIds.length})
                    </h2>

                    {selCountryIds.length === 0 ? (
                      <p className="text-sm text-crusader-gold/30 text-center py-8">
                        Click countries on the globe to add them
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1.5 mb-4">
                          {selCountryIds.map((id) => (
                            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-crusader-gold/5 border border-crusader-gold/15 group">
                              <div className="w-2 h-2 rounded-full bg-crusader-gold/60 shrink-0" />
                              <span className="text-xs text-crusader-gold/80 flex-1">{getCountryName(id)}</span>
                              <button
                                onClick={() => removeCountry(id)}
                                className="opacity-0 group-hover:opacity-100 text-crusader-gold/30 hover:text-red-400 transition-all"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Territory count slider */}
                        <div className="border-t border-crusader-gold/10 pt-4 mt-4">
                          <label className="text-xs font-cinzel text-crusader-gold/60 block mb-2">
                            Zone Count: <span className="text-crusader-gold font-bold">{tCount}</span>
                          </label>
                          <input
                            type="range" min={5} max={30} value={tCount}
                            onChange={(e) => setTCount(Number(e.target.value))}
                            className="w-full accent-crusader-gold cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-crusader-gold/25 mt-1">
                            <span>5 (Quick)</span><span>30 (Epic)</span>
                          </div>
                          <p className="text-xs text-crusader-gold/30 mt-2 flex items-start gap-1">
                            <Info size={10} className="shrink-0 mt-0.5" />
                            Zones are auto-generated within the selected area via Voronoi tessellation
                          </p>
                        </div>
                      </>
                    )}

                    {selCountryIds.length === 1 && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300/80">
                          Select at least 2 countries to create a map
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Continue button */}
              <div className="p-5 border-t border-crusader-gold/10">
                <Button
                  fullWidth
                  size="lg"
                  disabled={!canContinueFromSelect}
                  onClick={continueFromSelect}
                >
                  Configure Map <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* STEP: CONFIGURE                                                     */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === 'configure' && (
          <div className="flex-1 flex flex-col lg:flex-row">

            {/* Globe preview (50%) */}
            <div className="lg:flex-1 h-64 lg:h-auto relative">
              <EarthGlobe
                interactive={false}
                autoRotate={false}
                selectionMode={
                  mapType === 'continent' ? 'continent' :
                  mapType === 'countries' ? 'multi-country' : 'none'
                }
                selectedIds={
                  mapType === 'continent' && selContinent
                    ? getContinentCountryIds(selContinent)
                    : mapType === 'countries' ? selCountryIds : []
                }
                className="absolute inset-0 w-full h-full"
              />

              {/* Selection label */}
              <div className="absolute bottom-5 left-5">
                <div className="glass px-4 py-2.5 rounded-xl border border-crusader-gold/20">
                  <p className="text-xs text-crusader-gold/50 font-cinzel tracking-wide">
                    {mapType === 'globe'     ? 'Map Type' :
                     mapType === 'continent' ? 'Continent' : 'Countries'}
                  </p>
                  <p className="font-cinzel font-bold text-crusader-gold">
                    {mapType === 'globe'     ? 'Entire Globe' :
                     mapType === 'continent' ? CONTINENT_INFO[selContinent!].label :
                     `${selCountryIds.length} countries selected`}
                  </p>
                </div>
              </div>
            </div>

            {/* Config panel (50%) */}
            <div className="lg:w-[480px] flex flex-col border-l border-crusader-gold/10 overflow-y-auto">
              <div className="p-6 border-b border-crusader-gold/10">
                <button
                  onClick={() => setStep(mapType === 'globe' ? 'type' : 'select')}
                  className="flex items-center gap-2 text-xs text-crusader-gold/40 hover:text-crusader-gold transition-colors mb-3"
                >
                  <ChevronLeft size={12} /> Back
                </button>
                <h2 className="font-cinzel text-xl font-bold text-crusader-gold">Configure Map</h2>
                <p className="text-sm text-crusader-gold/40 mt-1">Set up your map details and default game settings</p>
              </div>

              <div className="flex-1 p-6 space-y-6">
                {/* Map metadata */}
                <section>
                  <h3 className="font-cinzel text-xs font-semibold text-crusader-gold/50 tracking-widest uppercase mb-3">Map Details</h3>
                  <div className="space-y-4">
                    <Input
                      label="Map Name"
                      value={config.mapName}
                      onChange={(e) => setConfig((c) => ({ ...c, mapName: e.target.value }))}
                      placeholder="Name your battlefield..."
                    />
                    <Input
                      label="Description (optional)"
                      value={config.mapDesc}
                      onChange={(e) => setConfig((c) => ({ ...c, mapDesc: e.target.value }))}
                      placeholder="Describe the strategic landscape..."
                    />
                  </div>
                </section>

                {/* Territories (countries mode only) */}
                {mapType === 'countries' && (
                  <section>
                    <h3 className="font-cinzel text-xs font-semibold text-crusader-gold/50 tracking-widest uppercase mb-3">Zone Generation</h3>
                    <div>
                      <label className="text-sm font-cinzel text-crusader-gold/70 block mb-2">
                        Territories: <span className="text-crusader-gold font-bold">{tCount}</span>
                      </label>
                      <input
                        type="range" min={5} max={30} value={tCount}
                        onChange={(e) => setTCount(Number(e.target.value))}
                        className="w-full accent-crusader-gold cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-crusader-gold/25 mt-1">
                        <span>5 (Small)</span><span>30 (Epic)</span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Game mode */}
                <section>
                  <h3 className="font-cinzel text-xs font-semibold text-crusader-gold/50 tracking-widest uppercase mb-3">Game Mode</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'lightning' as GameMode, icon: Zap,      label: '⚡ Lightning', sub: '1 min/turn'  },
                      { id: 'slow_hour' as GameMode, icon: Clock,    label: '⏱ Standard',  sub: '1 hr/turn'   },
                      { id: 'slow_day'  as GameMode, icon: Calendar, label: '📅 Epic',      sub: '1 day/turn'  },
                    ]).map(({ id, label, sub }) => (
                      <button
                        key={id}
                        onClick={() => setConfig((c) => ({ ...c, gameMode: id }))}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          config.gameMode === id
                            ? 'border-crusader-gold/60 bg-crusader-gold/15 text-crusader-gold'
                            : 'border-crusader-gold/10 text-crusader-gold/40 hover:border-crusader-gold/30'
                        }`}
                      >
                        <div className="text-sm font-cinzel font-medium">{label}</div>
                        <div className="text-xs mt-0.5 opacity-60">{sub}</div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Players */}
                <section>
                  <h3 className="font-cinzel text-xs font-semibold text-crusader-gold/50 tracking-widest uppercase mb-3">
                    <Users size={12} className="inline mr-1.5" />Players
                  </h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-cinzel text-crusader-gold/60 block mb-2">
                        Max Players: <span className="text-crusader-gold font-bold">{config.maxPlayers}</span>
                      </label>
                      <input
                        type="range" min={2} max={8} value={config.maxPlayers}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setConfig((c) => ({ ...c, maxPlayers: v, aiCount: Math.min(c.aiCount, v - 1) }))
                        }}
                        className="w-full accent-crusader-gold cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-crusader-gold/25 mt-1">
                        <span>2</span><span>8</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-cinzel text-crusader-gold/60 block mb-2">
                        AI Bots: <span className="text-crusader-gold font-bold">{config.aiCount}</span>
                      </label>
                      <input
                        type="range" min={0} max={config.maxPlayers - 1} value={config.aiCount}
                        onChange={(e) => setConfig((c) => ({ ...c, aiCount: Number(e.target.value) }))}
                        className="w-full accent-crusader-gold cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-crusader-gold/25 mt-1">
                        <span>0</span><span>{config.maxPlayers - 1}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Advanced settings */}
                <section>
                  <h3 className="font-cinzel text-xs font-semibold text-crusader-gold/50 tracking-widest uppercase mb-3">
                    <Settings size={12} className="inline mr-1.5" />Advanced Rules
                  </h3>
                  <div className="space-y-4">

                    {/* Spoils mode */}
                    <div>
                      <label className="text-xs font-cinzel text-crusader-gold/60 block mb-2">Card Spoils</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'fixed',       label: 'Fixed'       },
                          { id: 'progressive', label: 'Progressive' },
                          { id: 'none',        label: 'None'        },
                        ] as { id: SpoilsMode; label: string }[]).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setConfig((c) => ({ ...c, spoilsMode: id }))}
                            className={`py-2 px-3 rounded-lg border text-xs font-cinzel transition-all ${
                              config.spoilsMode === id
                                ? 'border-crusader-gold/50 bg-crusader-gold/15 text-crusader-gold'
                                : 'border-crusader-gold/10 text-crusader-gold/40 hover:border-crusader-gold/25'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'fogOfWar' as const, label: 'Fog of War',   icon: Eye },
                        { key: 'teamMode' as const, label: 'Team Mode',    icon: Users },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                            config[key]
                              ? 'border-crusader-gold/50 bg-crusader-gold/15 text-crusader-gold'
                              : 'border-crusader-gold/10 text-crusader-gold/30 hover:border-crusader-gold/25'
                          }`}
                        >
                          <Icon size={14} />
                          <span className="text-xs font-cinzel">{label}</span>
                          <span className={`ml-auto text-xs ${config[key] ? 'text-crusader-gold' : 'text-crusader-gold/25'}`}>
                            {config[key] ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Initial deployment */}
                    <div>
                      <label className="text-xs font-cinzel text-crusader-gold/60 block mb-2">Initial Deployment</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'auto',   label: 'Auto-Place'  },
                          { id: 'manual', label: 'Manual Draft' },
                        ] as { id: InitDeploy; label: string }[]).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setConfig((c) => ({ ...c, initDeploy: id }))}
                            className={`py-2.5 rounded-xl border text-xs font-cinzel transition-all ${
                              config.initDeploy === id
                                ? 'border-crusader-gold/50 bg-crusader-gold/15 text-crusader-gold'
                                : 'border-crusader-gold/10 text-crusader-gold/40 hover:border-crusader-gold/25'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </section>
              </div>

              {/* Generate button */}
              <div className="p-6 border-t border-crusader-gold/10">
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!config.mapName.trim()}
                >
                  Generate Zones <ChevronRight size={16} />
                </Button>
                {!config.mapName.trim() && (
                  <p className="text-xs text-crusader-gold/25 text-center mt-2">Enter a map name to continue</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* STEP: PREVIEW                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === 'preview' && territories.length > 0 && (
          <div className="flex-1 flex flex-col lg:flex-row">

            {/* Map canvas */}
            <div className="flex-1 relative bg-crusader-dark/30" style={{ minHeight: '55vh' }}>
              {/* Grid bg */}
              <div className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }} />
              <div className="absolute inset-0 p-4">
                <TerritoryMap territories={territories} editorMode className="w-full h-full" />
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <Button size="sm" variant="outline" icon={<Shuffle size={13} />} onClick={handleGenerate} loading={generating}>
                  Regenerate
                </Button>
                <Button size="sm" variant="outline" icon={<ChevronLeft size={13} />} onClick={() => setStep('configure')}>
                  Back
                </Button>
              </div>
            </div>

            {/* Side panel */}
            <div className="lg:w-80 flex flex-col border-l border-crusader-gold/10">
              <div className="p-4 border-b border-crusader-gold/10">
                <h3 className="font-cinzel text-sm font-semibold text-crusader-gold">
                  {config.mapName}
                </h3>
                <p className="text-xs text-crusader-gold/40 mt-1">
                  {territories.length} territories · {bonusGroups.length} bonus groups
                </p>
              </div>

              {/* Bonus groups */}
              {bonusGroups.length > 0 && (
                <div className="p-4 border-b border-crusader-gold/10">
                  <h4 className="text-xs font-cinzel text-crusader-gold/50 tracking-widest uppercase mb-2">Bonus Groups</h4>
                  <div className="space-y-1">
                    {bonusGroups.slice(0, 6).map((bg) => (
                      <div key={bg.id} className="flex items-center justify-between text-xs">
                        <span className="text-crusader-gold/60">{bg.name}</span>
                        <span className="text-crusader-gold font-bold">+{bg.bonus_armies} ✦</span>
                      </div>
                    ))}
                    {bonusGroups.length > 6 && (
                      <p className="text-xs text-crusader-gold/25">+{bonusGroups.length - 6} more...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Territory list */}
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-xs font-cinzel text-crusader-gold/50 tracking-widest uppercase mb-2">
                  Territories
                </h4>
                <div className="space-y-1">
                  {territories.slice(0, 60).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-crusader-gold/5 group transition-all">
                      {editingId === t.id ? (
                        <input
                          className="flex-1 bg-transparent border-b border-crusader-gold/40 text-xs text-crusader-gold focus:outline-none"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="text-xs text-crusader-gold/60 flex-1 truncate">{t.name}</span>
                          <button
                            onClick={() => { setEditingId(t.id); setEditName(t.name) }}
                            className="opacity-0 group-hover:opacity-100 text-crusader-gold/30 hover:text-crusader-gold transition-all"
                          >
                            <Edit3 size={10} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {territories.length > 60 && (
                    <p className="text-xs text-crusader-gold/25 text-center py-2">+{territories.length - 60} more territories</p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-crusader-gold/10">
                <Button fullWidth size="lg" icon={<Save size={15} />} onClick={handleSave} loading={saving}>
                  Publish Map
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* STEP: SAVE                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === 'save' && savedId && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-crusader-gold/20 border border-crusader-gold/40 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={36} className="text-crusader-gold" />
              </div>
              <h2 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold mb-3">Map Published!</h2>
              <p className="text-crusader-gold-light/60 mb-2">
                <span className="text-crusader-gold font-semibold">{config.mapName}</span> is ready for battle.
              </p>
              <p className="text-sm text-crusader-gold/40 mb-8">
                {territories.length} territories ·{' '}
                {mapType === 'globe'     ? 'Entire Globe' :
                 mapType === 'continent' ? CONTINENT_INFO[selContinent!].label :
                 `${selCountryIds.length} countries`}
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" icon={<Sword size={18} />} onClick={playMap}>
                  Create a Game
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  icon={<Plus size={18} />}
                  onClick={resetAll}
                >
                  Create Another Map
                </Button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
