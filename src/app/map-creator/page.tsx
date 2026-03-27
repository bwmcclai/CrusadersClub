'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useMemo } from 'react'
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
import type { BonusGroup, Territory } from '@/types'
import {
  Globe, Map as MapIcon, Layers,
  Save, CheckCircle, Plus, Sword,
  X, Shuffle, MapPin, ZoomIn, ZoomOut,
  ChevronLeft,
} from 'lucide-react'
import ZoneCartogram from '@/components/map/ZoneCartogram'

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

type MapMode = 'continent' | 'country' | 'province'
type AppView = 'globe' | 'preview'

interface MapMeta {
  name: string
  desc: string
}

// ─── Zoom Thresholds ──────────────────────────────────────────────────────────

const CONTINENT_ZOOM = 3.8
const COUNTRY_ZOOM = 2.5

function getModeFromZoom(d: number): MapMode {
  if (d >= CONTINENT_ZOOM) return 'continent'
  if (d >= COUNTRY_ZOOM) return 'country'
  return 'province'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRegionBounds(features: GeoJSON.Feature[]) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const feat of features) {
    const geo = feat.geometry
    if (!geo) continue
    const coords: number[][][] =
      geo.type === 'Polygon' ? geo.coordinates as number[][][] :
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
    continent: { label: 'Continent Mode', hint: 'Click to select entire continents', icon: Globe },
    country: { label: 'Country Mode', hint: 'Click countries to add them to the map', icon: MapIcon },
    province: { label: 'Fine Detail Mode', hint: 'Click individual territories', icon: Layers },
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
          { m: 'continent' as MapMode, label: 'Continents', Icon: ZoomOut },
          { m: 'country' as MapMode, label: 'Countries', Icon: Globe },
          { m: 'province' as MapMode, label: 'Provinces', Icon: ZoomIn },
        ]).map(({ m, label, Icon }) => (
          <div key={m} className={`flex items-center gap-2 text-[10px] font-cinzel tracking-wide ${mode === m ? 'text-crusader-gold' : 'text-crusader-gold/25'
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
  const [zoomDistance, setZoomDistance] = useState(2.8)
  const [selCountryIds, setSelCountryIds] = useState<number[]>([])
  const [selCountryFeats, setSelCountryFeats] = useState<GeoJSON.Feature[]>([])
  const [selContinents, setSelContinents] = useState<ContinentId[]>([])

  // ── Map metadata ──────────────────────────────────────────────────────────────
  const [meta, setMeta] = useState<MapMeta>({ name: '', desc: '' })
  const [zoneCount, setZoneCount] = useState(25)

  // ── Generated output ──────────────────────────────────────────────────────────
  const [generatedCities,      setGeneratedCities]      = useState<CityFull[]>([])
  const [generatedTerritories, setGeneratedTerritories] = useState<Territory[]>([])
  const [bonusGroups,          setBonusGroups]          = useState<BonusGroup[]>([])
  const [previewTab,           setPreviewTab]           = useState<'cartogram' | 'globe'>('globe')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const mapMode = getModeFromZoom(zoomDistance)
  const globeSelMode = mapMode === 'continent' ? 'continent' : 'multi-country'

  const markers: MarkerDef[] = useMemo(() => generatedCities.map((c, i) => ({
    id: `city-${i}`,
    lat: c.lat,
    lon: c.lon,
    label: c.name,
  })), [generatedCities])

  // ── Continent selection ───────────────────────────────────────────────────────
  const handleContinentSelect = useCallback((
    continent: ContinentId,
    countryIds: number[],
    features: GeoJSON.Feature[],
  ) => {
    const already = selContinents.includes(continent)
    if (already) {
      setSelContinents((p) => p.filter((c) => c !== continent))
      setSelCountryIds((p) => p.filter((id) => !countryIds.includes(id)))
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
    setGeneratedCities([]); setGeneratedTerritories([]); setBonusGroups([]); setSavedId(null)
  }, [])

  // ── Auto-generate zones when selection or count changes ─────────────────────
  useEffect(() => {
    if (selCountryIds.length === 0) {
      setGeneratedCities([])
      setGeneratedTerritories([])
      setBonusGroups([])
      return
    }

    // Get all cities for selected countries sorted by population
    const allCities = getCitiesForCountries(selCountryIds)
    const topCities = allCities.slice(0, Math.max(2, zoneCount))
    setGeneratedCities(topCities)

    if (selCountryFeats.length === 0) {
      setGeneratedTerritories([])
      setBonusGroups([])
      setSavedId(null)
      return
    }

    // Generate Voronoi zones clipped to country boundaries
    const result = generateZonesFromCities(allCities, selCountryFeats, zoneCount)

    // Fix bonus group names (generateZonesFromCities uses placeholder names)
    const namedGroups: BonusGroup[] = result.bonusGroups.map((bg) => {
      const iso = parseInt(bg.id.replace('bonus-', ''))
      return { ...bg, name: getCountryName(iso) || bg.name }
    })

    setGeneratedTerritories(result.territories)
    setBonusGroups(namedGroups)
    setSavedId(null)
  }, [selCountryIds, selCountryFeats, zoneCount])

  // ── Preview toggle ────────────────────────────────────────────────────────────
  function handleGenerate() {
    if (selCountryIds.length === 0) return
    setView('preview')
  }

  // ── Rename territory ──────────────────────────────────────────────────────────
  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveError(null)
    if (!player) { setSaveError('You must be signed in to save a map.'); return }
    if (generatedTerritories.length === 0) { setSaveError('Generate zones first.'); return }
    if (!meta.name.trim()) { setSaveError('Please enter a map name.'); return }
    setSaving(true)
    try {
      const bounds = selCountryFeats.length > 0
        ? computeRegionBounds(selCountryFeats)
        : { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 }

      const regionName = selContinents.length > 0
        ? selContinents.map((c) => CONTINENT_INFO[c].label).join(' + ')
        : selCountryIds.slice(0, 5).map(getCountryName).filter(Boolean).join(', ') +
        (selCountryIds.length > 5 ? ` +${selCountryIds.length - 5} more` : '')

      const sb = getSupabaseClient()
      const { data, error } = await sb.from('battle_maps').insert({
        name: meta.name.trim(),
        description: meta.desc.trim() || null,
        author_id: player.id,
        region_name: regionName || 'Custom Region',
        region_bounds: bounds,
        country_iso_ids: selCountryIds,
        territories: generatedTerritories,
        bonus_groups: bonusGroups,
        is_public: true,
      }).select('id').single()

      if (error) throw error
      setSavedId(data.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setSaveError(msg)
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // ───────────────�        <main className="flex-1 flex flex-row overflow-hidden pt-20">

          {/* Left Panel */}
          <div
            className="w-80 xl:w-96 flex flex-col border-r border-crusader-gold/10 overflow-hidden"
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
                type="range" min={2} max={50} value={zoneCount}
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
                <span>50 max</span>
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
                Review Map
              </Button>
              {selCountryIds.length === 0 && (
                <p className="text-[10px] text-crusader-gold/25 text-center font-cinzel">
                  Select regions on the globe first
                </p>
              )}
            </div>
          </div>

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
              markers={markers}
              territories={generatedTerritories}
              countryFeatures={selCountryFeats}
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

        </main>
</span>
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
                type="range" min={2} max={50} value={zoneCount}
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
                <span>50 max</span>
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
                Review Map
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



  const canSave = !!player && meta.name.trim().length > 0 && generatedTerritories.length > 0

  return (
    <div className="h-screen bg-crusader-void flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-row overflow-hidden pt-20">

        {/* Main view: Zone Cartogram or Globe */}
        <div className="flex-1 relative overflow-hidden bg-crusader-void">

          {previewTab === 'cartogram' ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <ZoneCartogram territories={generatedTerritories} />
            </div>
          ) : (
            <EarthGlobe
              interactive
              autoRotate={false}
              selectionMode="none"
              markers={markers}
              territories={generatedTerritories}
              countryFeatures={selCountryFeats}
              className="absolute inset-0 w-full h-full"
            />
          )}

          {/* View toggle */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex">
            {(['cartogram', 'globe'] as const).map((tab, i) => (
              <button
                key={tab}
                onClick={() => setPreviewTab(tab)}
                className={`px-4 py-1.5 text-[11px] font-cinzel tracking-wider border border-crusader-gold/25 backdrop-blur-md transition-colors ${
                  i === 0 ? 'rounded-l-full' : 'rounded-r-full border-l-0'
                } ${
                  previewTab === tab
                    ? 'bg-crusader-gold/20 text-crusader-gold'
                    : 'bg-crusader-void/70 text-crusader-gold/35 hover:text-crusader-gold/65'
                }`}
              >
                {tab === 'cartogram' ? 'Zone Map' : 'Globe'}
              </button>
            ))}
          </div>

          {/* Zone count badge */}
          <div className="absolute top-4 right-5 pointer-events-none">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 backdrop-blur-md"
              style={{ background: 'rgba(8,6,4,0.70)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400" style={{ boxShadow: '0 0 6px rgba(77,217,172,0.8)' }} />
              <span className="font-cinzel text-[11px] text-teal-300 tracking-widest">
                {generatedTerritories.length} Zones
              </span>
            </div>
          </div>
        </div>

        {/* Right panel — fixed height, flex column so footer is always visible */}
        <div
          className="w-80 xl:w-96 flex flex-col border-l border-crusader-gold/10"
          style={{ background: 'rgba(6,5,3,0.92)', backdropFilter: 'blur(12px)', height: '100%' }}
        >
          {/* ── Header ── */}
          <div className="shrink-0 px-5 pt-5 pb-3 border-b border-crusader-gold/10">
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

          {/* ── Map Name ── */}
          <div className="shrink-0 px-5 pt-3 pb-3 border-b border-crusader-gold/8">
            <SectionHeader>Map Name</SectionHeader>
            <Input
              value={meta.name}
              onChange={(e) => { setMeta((m) => ({ ...m, name: e.target.value })); setSaveError(null) }}
              placeholder="Name your map..."
            />
          </div>

          {/* ── Bonus Groups (compact pills) ── */}
          {bonusGroups.length > 0 && (
            <div className="shrink-0 px-5 pt-3 pb-3 border-b border-crusader-gold/8">
              <div className="flex items-center justify-between mb-1.5">
                <SectionHeader>Bonus Groups</SectionHeader>
                <span className="text-[10px] font-cinzel text-crusader-gold/35 mb-2.5">
                  {bonusGroups.length} group{bonusGroups.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bonusGroups.map((bg) => (
                  <div
                    key={bg.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-crusader-gold/8 border border-crusader-gold/12 text-[10px] font-cinzel"
                  >
                    <span className="text-crusader-gold/65 truncate max-w-[80px]">{bg.name}</span>
                    <span className="text-crusader-gold font-bold shrink-0">+{bg.bonus_armies}✦</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Deployable Zones — fills remaining space and scrolls internally ── */}
          <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-none min-h-0">
            <SectionHeader>Deployable Zones ({generatedCities.length})</SectionHeader>
            <div className="space-y-0.5">
              {generatedCities.map((c, i) => {
                const cont = getContinent(c.country)
                return (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-crusader-gold/5 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 border border-teal-400/60 bg-teal-900/60" />
                    <span className="text-[11px] text-crusader-gold/65 flex-1 truncate font-cinzel">{c.name}</span>
                    {cont && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONTINENT_INFO[cont]?.color ?? '#C9A84C' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Sticky footer — always visible ── */}
          <div className="shrink-0 px-5 py-4 border-t border-crusader-gold/10 space-y-2" style={{ background: 'rgba(6,5,3,0.97)' }}>
            {/* Zone slider (compact) */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-cinzel text-crusader-gold/40 uppercase tracking-widest whitespace-nowrap">Zones</span>
              <input
                type="range" min={2} max={200} value={zoneCount}
                onChange={(e) => setZoneCount(Number(e.target.value))}
                className="flex-1 accent-crusader-gold cursor-pointer"
              />
              <span className="text-[11px] font-cinzel font-bold text-crusader-gold w-6 text-right">{zoneCount}</span>
            </div>

            {/* Regenerate */}
            <Button
              fullWidth
              size="sm"
              variant="outline"
              icon={<ChevronLeft size={13} />}
              onClick={() => setView('globe')}
            >
              Back to Globe
            </Button>

            {/* Error */}
            {saveError && (
              <p className="text-[10px] text-red-400/85 font-cinzel text-center leading-relaxed">{saveError}</p>
            )}

            {/* Save & Publish */}
            <Button
              fullWidth
              size="lg"
              disabled={!canSave || saving}
              loading={saving}
              onClick={handleSave}
              icon={<Save size={15} />}
            >
              Save &amp; Publish Map
            </Button>

            {!player && (
              <p className="text-[10px] text-amber-400/60 text-center font-cinzel">Sign in to publish maps</p>
            )}
            {player && !meta.name.trim() && (
              <p className="text-[10px] text-crusader-gold/25 text-center font-cinzel">Enter a map name to publish</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

