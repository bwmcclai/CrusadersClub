'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { generateZonesFromCities } from '@/lib/utils'
import { getCitiesForCountries, type CityFull } from '@/lib/citiesData'
import type { MarkerDef } from '@/components/three/EarthGlobe'
import {
  type ContinentId, getCountryName, getContinent, getContinentCountryIds,
  CONTINENT_INFO,
} from '@/lib/geoData'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { BonusGroup } from '@/types'
import {
  Globe, Map as MapIcon, Layers,
  Save, CheckCircle, Plus, Sword,
  X, Shuffle, MapPin, ZoomIn, ZoomOut,
  ChevronLeft,
} from 'lucide-react'

// ─── Dynamic import (Three.js SSR guard) ──────────────────────────────────────

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
        <p className="text-crusader-gold/60 font-cinzel text-sm tracking-widest">Loading Globe...</p>
      </div>
    </div>
  ),
})

// ─── Types ─────────────────────────────────────────────────────────────────────

type MapMode  = 'continent' | 'country' | 'province'
type AppView  = 'globe' | 'preview'

interface MapMeta {
  name: string
  desc: string
}

// ─── Zoom Thresholds ──────────────────────────────────────────────────────────

const CONTINENT_ZOOM = 3.8
const COUNTRY_ZOOM   = 2.5

function getModeFromZoom(d: number): MapMode {
  if (d >= CONTINENT_ZOOM) return 'continent'
  if (d >= COUNTRY_ZOOM)   return 'country'
  return 'province'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRegionBounds(features: GeoJSON.Feature[]) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const feat of features) {
    const geo = feat.geometry
    if (!geo) continue
    const coords: number[][][] =
      geo.type === 'Polygon'      ? geo.coordinates as number[][][] :
      geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() : []
    for (const ring of coords)
      for (const [lon, lat] of ring) {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
      }
  }
  return { minLat, maxLat, minLon, maxLon }
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-cinzel text-[10px] font-semibold text-crusader-gold/45 tracking-[0.2em] uppercase mb-2.5">
      {children}
    </h3>
  )
}

function Divider() {
  return <div className="border-t border-crusader-gold/8 my-4" />
}

// ─── Mode Indicator (globe overlay) ──────────────────────────────────────────

function ModeIndicator({ mode }: { mode: MapMode }) {
  const labels: Record<MapMode, { label: string; hint: string; icon: typeof Globe }> = {
    continent: { label: 'Continent Mode',   hint: 'Click to select entire continents',     icon: Globe   },
    country:   { label: 'Country Mode',     hint: 'Click countries to add them to the map', icon: MapIcon },
    province:  { label: 'Fine Detail Mode', hint: 'Click individual territories',           icon: Layers },
  }
  const { label, hint, icon: Icon } = labels[mode]
  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center gap-1.5">
      <div
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-crusader-gold/25 backdrop-blur-md"
        style={{ background: 'rgba(8,6,4,0.70)' }}
      >
        <Icon size={13} className="text-crusader-gold" />
        <span className="font-cinzel text-xs text-crusader-gold tracking-widest">{label}</span>
      </div>
      <p className="text-[10px] text-crusader-gold/45 font-cinzel tracking-wide">{hint}</p>
    </div>
  )
}

function ZoomGuide({ mode }: { mode: MapMode }) {
  return (
    <div className="absolute bottom-16 right-5 pointer-events-none z-10">
      <div
        className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border border-crusader-gold/15 backdrop-blur-sm"
        style={{ background: 'rgba(8,6,4,0.65)' }}
      >
        {([
          { m: 'continent' as MapMode, label: 'Continents', Icon: ZoomOut  },
          { m: 'country'   as MapMode, label: 'Countries',  Icon: Globe    },
          { m: 'province'  as MapMode, label: 'Provinces',  Icon: ZoomIn   },
        ]).map(({ m, label, Icon }) => (
          <div key={m} className={`flex items-center gap-2 text-[10px] font-cinzel tracking-wide ${
            mode === m ? 'text-crusader-gold' : 'text-crusader-gold/25'
          }`}>
            <Icon size={10} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapCreatorPage() {
  const router = useRouter()
  const player = useAppStore((s) => s.player)

  // ── View state ────────────────────────────────────────────────────────────────
  const [view, setView] = useState<AppView>('globe')

  // ── Globe interaction ─────────────────────────────────────────────────────────
  const [zoomDistance,    setZoomDistance]    = useState(2.8)
  const [selCountryIds,   setSelCountryIds]   = useState<number[]>([])
  const [selCountryFeats, setSelCountryFeats] = useState<GeoJSON.Feature[]>([])
  const [selContinents,   setSelContinents]   = useState<ContinentId[]>([])

  // ── Map metadata ──────────────────────────────────────────────────────────────
  const [meta,       setMeta]       = useState<MapMeta>({ name: '', desc: '' })
  const [zoneCount,  setZoneCount]  = useState(25)

  // ── Generated output ──────────────────────────────────────────────────────────
  const [generatedCities, setGeneratedCities] = useState<CityFull[]>([])
  const [bonusGroups,     setBonusGroups]     = useState<BonusGroup[]>([])
  const [generating,  setGenerating]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [savedId,     setSavedId]     = useState<string | null>(null)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editName,    setEditName]    = useState('')

  // ── Derived ───────────────────────────────────────────────────────────────────
  const mapMode      = getModeFromZoom(zoomDistance)
  const globeSelMode = mapMode === 'continent' ? 'continent' : 'multi-country'

  // ── Continent selection ───────────────────────────────────────────────────────
  const handleContinentSelect = useCallback((
    continent: ContinentId,
    countryIds: number[],
    features: GeoJSON.Feature[],
  ) => {
    const already = selContinents.includes(continent)
    if (already) {
      setSelContinents((p) => p.filter((c) => c !== continent))
      setSelCountryIds((p)  => p.filter((id) => !countryIds.includes(id)))
      setSelCountryFeats((p) => p.filter((f) => {
        const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
        return !countryIds.includes(fid)
      }))
    } else {
      setSelContinents((p) => [...p, continent])
      setSelCountryIds((p) => [...p, ...countryIds.filter((id) => !p.includes(id))])
      setSelCountryFeats((p) => {
        const existing = new Set(p.map((f) => typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)))
        return [...p, ...features.filter((f) => {
          const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
          return !existing.has(fid)
        })]
      })
      if (!meta.name) {
        setMeta((m) => ({ ...m, name: `${CONTINENT_INFO[continent].label} — ${new Date().getFullYear()}` }))
      }
    }
  }, [selContinents, meta.name])

  // ── Country toggle ────────────────────────────────────────────────────────────
  const handleCountryToggle = useCallback((id: number, _name: string, feat: GeoJSON.Feature) => {
    setSelCountryIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
    setSelCountryFeats((p) => {
      const exists = p.some((f) => (typeof f.id === 'string' ? parseInt(f.id) : f.id as number) === id)
      return exists
        ? p.filter((f) => (typeof f.id === 'string' ? parseInt(f.id) : f.id as number) !== id)
        : [...p, feat]
    })
  }, [])

  const removeCountry = useCallback((id: number) => {
    setSelCountryIds((p) => p.filter((x) => x !== id))
    setSelCountryFeats((p) => p.filter((f) => (typeof f.id === 'string' ? parseInt(f.id) : f.id as number) !== id))
  }, [])

  const clearAll = useCallback(() => {
    setSelCountryIds([]); setSelCountryFeats([]); setSelContinents([])
    setGeneratedCities([]); setBonusGroups([]); setSavedId(null)
  }, [])

  // ── Generate zones → switch to preview ────────────────────────────────────────
  async function handleGenerate() {
    if (selCountryIds.length === 0) return
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 50))
    try {
      // Get top-N most-populated cities from the selected countries
      const allCities = getCitiesForCountries(selCountryIds)
      const topCities = allCities.slice(0, Math.max(2, zoneCount))

      // Build bonus groups per country (no Voronoi needed — just markers for now)
      const countryMap = new Map<number, CityFull[]>()
      for (const c of topCities) {
        if (!countryMap.has(c.country)) countryMap.set(c.country, [])
        countryMap.get(c.country)!.push(c)
      }
      const namedGroups: BonusGroup[] = Array.from(countryMap.entries()).map(([iso, cities]) => ({
        id:            `bonus-${iso}`,
        name:          getCountryName(iso) || `Country ${iso}`,
        territory_ids: cities.map((_, i) => `city-${i}`),
        bonus_armies:  Math.max(2, Math.round(cities.length / 3)),
      }))

      setGeneratedCities(topCities)
      setBonusGroups(namedGroups)
      setSavedId(null)
      setView('preview')
    } finally {
      setGenerating(false)
    }
  }

  // ── Rename territory ──────────────────────────────────────────────────────────
  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!player || generatedCities.length === 0 || !meta.name.trim()) return
    setSaving(true)
    try {
      const bounds = selCountryFeats.length > 0
        ? computeRegionBounds(selCountryFeats)
        : { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 }

      const regionName = selContinents.length > 0
        ? selContinents.map((c) => CONTINENT_INFO[c].label).join(' + ')
        : selCountryIds.slice(0, 5).map(getCountryName).join(', ') +
          (selCountryIds.length > 5 ? ` +${selCountryIds.length - 5} more` : '')

      const sb = getSupabaseClient()
      const { data, error } = await sb.from('battle_maps').insert({
        name:          meta.name,
        description:   meta.desc || null,
        author_id:     player.id,
        region_name:   regionName,
        region_bounds: bounds,
        territories:   generatedCities.map((c, i) => ({
          id:           `city-${i}`,
          name:         c.name,
          polygon:      [] as [number, number][],
          seed:         [c.lon, c.lat] as [number, number],
          adjacent_ids: [] as string[],
        })),
        bonus_groups:  bonusGroups,
        is_public:     true,
      }).select('id').single()

      if (error) throw error
      setSavedId(data.id)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Published success screen ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  if (savedId) {
    return (
      <div className="min-h-screen bg-crusader-void flex items-center justify-center p-8">
        <div className="text-center max-w-lg animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-crusader-gold/20 border border-crusader-gold/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-crusader-gold" />
          </div>
          <h2 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold mb-3">Map Published!</h2>
          <p className="text-crusader-gold-light/60 mb-2">
            <span className="text-crusader-gold font-semibold">{meta.name}</span> is ready for battle.
          </p>
          <p className="text-sm text-crusader-gold/40 mb-8">
            {generatedCities.length} territories · {bonusGroups.length} bonus groups
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" icon={<Sword size={18} />} onClick={() => router.push(`/lobby?newMapId=${savedId}`)}>
              Create a Game
            </Button>
            <Button size="lg" variant="outline" icon={<Plus size={18} />} onClick={() => {
              clearAll()
              setSavedId(null)
              setMeta({ name: '', desc: '' })
              setView('globe')
            }}>
              Create Another
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Main layout: Globe view ───────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === 'globe') {
    return (
      <div className="min-h-screen bg-crusader-void flex flex-col">
        <main className="flex-1 pt-16 flex flex-row overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

          {/* Globe */}
          <div className="flex-1 relative bg-crusader-void overflow-hidden">
            <EarthGlobe
              interactive
              autoRotate={false}
              selectionMode={globeSelMode}
              selectedIds={selCountryIds}
              onContinentSelect={handleContinentSelect}
              onMultiCountryToggle={handleCountryToggle}
              onZoomChange={setZoomDistance}
              className="absolute inset-0 w-full h-full"
            />
            <ModeIndicator mode={mapMode} />
            <ZoomGuide mode={mapMode} />

            {selCountryIds.length > 0 && (
              <div className="absolute top-5 right-5 pointer-events-none">
                <div
                  className="px-3 py-1.5 rounded-full border border-crusader-gold/30 backdrop-blur-md"
                  style={{ background: 'rgba(8,6,4,0.75)' }}
                >
                  <span className="font-cinzel text-xs text-crusader-gold">
                    {selCountryIds.length} {selCountryIds.length === 1 ? 'territory' : 'territories'} selected
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div
            className="w-80 xl:w-96 flex flex-col border-l border-crusader-gold/10 overflow-hidden"
            style={{ background: 'rgba(6,5,3,0.92)', backdropFilter: 'blur(12px)' }}
          >
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-crusader-gold/10">
              <div className="flex items-center gap-2.5 mb-0.5">
                <Globe size={15} className="text-crusader-gold" />
                <h1 className="font-cinzel text-base font-bold text-crusader-gold tracking-wide">Map Creator</h1>
              </div>
              <p className="text-[11px] text-crusader-gold/35 font-cinzel tracking-wide pl-6">Forge your battlefield</p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 scrollbar-none">

              {/* Map identity */}
              <SectionHeader>Map Identity</SectionHeader>
              <div className="space-y-3 mb-1">
                <Input
                  label="Map Name"
                  value={meta.name}
                  onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
                  placeholder="Name your battlefield..."
                />
                <div>
                  <label className="block text-[11px] font-cinzel text-crusader-gold/50 tracking-widest uppercase mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={meta.desc}
                    onChange={(e) => setMeta((m) => ({ ...m, desc: e.target.value }))}
                    placeholder="Describe the strategic landscape..."
                    rows={2}
                    className="w-full bg-crusader-dark/60 border border-crusader-gold/15 rounded-xl px-3 py-2.5 text-xs text-crusader-gold/70 placeholder:text-crusader-gold/20 focus:outline-none focus:border-crusader-gold/40 resize-none font-cinzel"
                  />
                </div>
              </div>

              <Divider />

              {/* Selected regions */}
              <div className="flex items-center justify-between mb-2.5">
                <SectionHeader>Selected Regions</SectionHeader>
                {selCountryIds.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-crusader-gold/30 hover:text-red-400 font-cinzel transition-colors mb-2.5"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selCountryIds.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <MapPin size={18} className="text-crusader-gold/15" />
                  <p className="text-xs text-crusader-gold/25 font-cinzel leading-relaxed">
                    Click on the globe to select<br />countries or continents
                  </p>
                  <p className="text-[10px] text-crusader-gold/15 font-cinzel">Zoom out for continent mode</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-none">
                  {selCountryIds.map((id) => {
                    const cont = getContinent(id)
                    return (
                      <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-crusader-gold/5 border border-crusader-gold/10 group">
                        {cont && (
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONTINENT_INFO[cont]?.color ?? '#C9A84C' }} />
                        )}
                        <span className="text-xs text-crusader-gold/70 flex-1 truncate font-cinzel">{getCountryName(id)}</span>
                        <button
                          onClick={() => removeCountry(id)}
                          className="opacity-0 group-hover:opacity-100 text-crusader-gold/25 hover:text-red-400 transition-all"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {/* Zone count slider — always visible */}
            <div className="shrink-0 px-5 py-4 border-t border-crusader-gold/10" style={{ background: 'rgba(6,5,3,0.88)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-cinzel text-crusader-gold/55 uppercase tracking-widest">
                  Deployable Zones
                </span>
                <span className="text-sm font-cinzel font-bold text-crusader-gold">{zoneCount}</span>
              </div>
              <input
                type="range" min={2} max={200} value={zoneCount}
                onChange={(e) => setZoneCount(Number(e.target.value))}
                className="w-full accent-crusader-gold cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-crusader-gold/20 mt-1 font-cinzel">
                <span>2 min</span>
                <span className="text-crusader-gold/35 text-center">
                  {selCountryIds.length > 0
                    ? `${getCitiesForCountries(selCountryIds).length} cities available`
                    : 'select regions first'}
                </span>
                <span>200 max</span>
              </div>
              {selCountryIds.length > 0 && zoneCount > getCitiesForCountries(selCountryIds).length && (
                <p className="text-[10px] text-amber-400/70 font-cinzel mt-1.5 text-center">
                  Only {getCitiesForCountries(selCountryIds).length} cities available — will use all
                </p>
              )}
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 px-5 py-4 border-t border-crusader-gold/10 space-y-2" style={{ background: 'rgba(6,5,3,0.95)' }}>
              <Button
                fullWidth
                size="lg"
                disabled={selCountryIds.length === 0}
                loading={generating}
                onClick={handleGenerate}
                icon={<Layers size={15} />}
              >
                Generate Zones
              </Button>
              {selCountryIds.length === 0 && (
                <p className="text-[10px] text-crusader-gold/25 text-center font-cinzel">
                  Select regions on the globe first
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Preview view — globe with city markers ────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  // Build markers from the generated city list
  const markers: MarkerDef[] = generatedCities.map((c, i) => ({
    id:    `city-${i}`,
    lat:   c.lat,
    lon:   c.lon,
    label: c.name,
  }))

  return (
    <div className="min-h-screen bg-crusader-void flex flex-col">
      <main className="flex-1 pt-16 flex flex-row overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

        {/* Globe with zone markers */}
        <div className="flex-1 relative overflow-hidden">
          <EarthGlobe
            interactive
            autoRotate={false}
            selectionMode="none"
            markers={markers}
            className="absolute inset-0 w-full h-full"
          />

          {/* Zone count badge */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none">
            <div
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-teal-500/30 backdrop-blur-md"
              style={{ background: 'rgba(8,6,4,0.70)' }}
            >
              <div className="w-2 h-2 rounded-full bg-teal-400" style={{ boxShadow: '0 0 6px rgba(77,217,172,0.8)' }} />
              <span className="font-cinzel text-xs text-teal-300 tracking-widest">
                {generatedCities.length} Deployable Zones
              </span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div
          className="w-80 xl:w-96 flex flex-col border-l border-crusader-gold/10 overflow-hidden"
          style={{ background: 'rgba(6,5,3,0.92)', backdropFilter: 'blur(12px)' }}
        >
          {/* Header */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-crusader-gold/10">
            <button
              onClick={() => setView('globe')}
              className="flex items-center gap-1.5 text-[11px] font-cinzel text-crusader-gold/35 hover:text-crusader-gold/70 transition-colors mb-3"
            >
              <ChevronLeft size={12} /> Back to Globe
            </button>
            <h2 className="font-cinzel text-base font-bold text-crusader-gold">{meta.name || 'Untitled Map'}</h2>
            <p className="text-[11px] text-crusader-gold/35 font-cinzel mt-0.5">
              {generatedCities.length} zones · {bonusGroups.length} bonus groups
            </p>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-none">

            <SectionHeader>Map Name</SectionHeader>
            <Input
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
              placeholder="Name your map..."
              className="mb-4"
            />

            <Divider />

            {/* Bonus groups */}
            {bonusGroups.length > 0 && (
              <>
                <SectionHeader>Bonus Groups</SectionHeader>
                <div className="space-y-1 mb-4">
                  {bonusGroups.map((bg) => (
                    <div key={bg.id} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-crusader-gold/5 border border-crusader-gold/10">
                      <span className="text-crusader-gold/60 font-cinzel truncate">{bg.name}</span>
                      <span className="text-crusader-gold font-bold font-cinzel shrink-0 ml-2">+{bg.bonus_armies} ✦</span>
                    </div>
                  ))}
                </div>
                <Divider />
              </>
            )}

            {/* Deployable zones list */}
            <SectionHeader>Deployable Zones</SectionHeader>
            <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-none">
              {generatedCities.map((c, i) => {
                const cont = getContinent(c.country)
                return (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-crusader-gold/5 group transition-all">
                    <div className="w-2 h-2 rounded-full shrink-0 border border-teal-400/60 bg-teal-900/60" />
                    <span className="text-[11px] text-crusader-gold/65 flex-1 truncate font-cinzel">{c.name}</span>
                    {cont && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONTINENT_INFO[cont]?.color ?? '#C9A84C' }} />
                    )}
                  </div>
                )
              })}
            </div>

          </div>

          {/* Sticky footer */}
          <div className="shrink-0 px-5 py-4 border-t border-crusader-gold/10 space-y-2.5" style={{ background: 'rgba(6,5,3,0.95)' }}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-cinzel text-crusader-gold/45 uppercase tracking-widest">Zone Count</span>
                <span className="text-xs font-cinzel font-bold text-crusader-gold">{zoneCount}</span>
              </div>
              <input
                type="range" min={2} max={200} value={zoneCount}
                onChange={(e) => setZoneCount(Number(e.target.value))}
                className="w-full accent-crusader-gold cursor-pointer"
              />
            </div>
            <Button
              fullWidth
              size="sm"
              variant="outline"
              icon={<Shuffle size={13} />}
              onClick={handleGenerate}
              loading={generating}
            >
              Regenerate with {zoneCount} Zones
            </Button>
            <Button
              fullWidth
              size="lg"
              disabled={!meta.name.trim()}
              loading={saving}
              onClick={handleSave}
              icon={<Save size={15} />}
            >
              Save & Publish Map
            </Button>
            {!meta.name.trim() && (
              <p className="text-[10px] text-crusader-gold/25 text-center font-cinzel">Enter a map name to publish</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
