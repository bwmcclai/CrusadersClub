'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useMemo } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { generateZonesFromCities } from '@/lib/utils'
import { getCitiesForCountries, getCapitalsForCountries, type CityFull } from '@/lib/citiesData'
import type { MarkerDef } from '@/components/three/EarthGlobe'
import { getCountryName, getContinentCountryIds, CONTINENT_COUNTRIES } from '@/lib/geoData'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { geoContains } from 'd3-geo'
import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import type { BonusGroup, Territory } from '@/types'
import { Globe, Save, X } from 'lucide-react'

// --- Dynamic import (Three.js SSR guard) --------------------------------------

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

// --- Types ---------------------------------------------------------------------

interface MapMeta {
  name: string
  desc: string
}

// --- Helpers ------------------------------------------------------------------

function computeRegionBounds(features: GeoJSON.Feature[]) {
  let minLat = 90, maxLat = -90
  const allLons: number[] = []

  for (const feat of features) {
    const geo = feat.geometry
    if (!geo) continue
    const coords: number[][][] =
      geo.type === 'Polygon' ? geo.coordinates as number[][][] :
        geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() : []
    for (const ring of coords)
      for (const [lon, lat] of ring) {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
        allLons.push(lon)
      }
  }

  let minLon = Math.min(...allLons)
  let maxLon = Math.max(...allLons)

  // Fix antimeridian-crossing bounds: GeoJSON stores some regions (e.g. Alaska's
  // Aleutian Islands) at positive longitudes past 90°E even though the country is
  // primarily in the western hemisphere. This causes the naive centre to land on
  // the wrong side of the globe (e.g. the USA centres on West Africa instead of
  // the continental US). Detect and normalise these cases.
  if (maxLon - minLon > 180 && maxLon > 90 && minLon < 0) {
    const negCount = allLons.filter(l => l < 0).length
    if (negCount > allLons.length / 2) {
      // Majority of vertices are in the western hemisphere →
      // fold the positive-longitude outliers into negative equivalents.
      const adjusted = allLons.map(l => (l > 90 ? l - 360 : l))
      minLon = Math.min(...adjusted)
      maxLon = Math.max(...adjusted)
    }
  }

  return { minLat, maxLat, minLon, maxLon }
}

// --- City deduplication by admin-1 subdivision --------------------------------
// Ensures at most one city per state/province, keeping the most populous.
// Cities whose country has no admin-1 data (small islands etc.) pass through.

function deduplicateCitiesBySubdivision(
  cities: CityFull[],             // sorted pop desc — first city per subdiv wins
  admin1: GeoJSON.Feature[],
): CityFull[] {
  const byCountry = new Map<number, GeoJSON.Feature[]>()
  for (const f of admin1) {
    const iso = (f.properties as any)?.iso_n3 as number | undefined
    if (!iso) continue
    if (!byCountry.has(iso)) byCountry.set(iso, [])
    byCountry.get(iso)!.push(f)
  }

  const claimed = new Set<string | number>()
  const result: CityFull[] = []

  for (const city of cities) {
    const subdivs = byCountry.get(city.country)
    if (!subdivs || subdivs.length === 0) {
      result.push(city)
      continue
    }

    let subdivId: string | number | null = null
    for (const sub of subdivs) {
      if (sub.id != null && geoContains(sub as any, [city.lon, city.lat])) {
        subdivId = sub.id as string | number
        break
      }
    }

    if (subdivId === null || !claimed.has(subdivId)) {
      if (subdivId !== null) claimed.add(subdivId)
      result.push(city)
    }
    // else: a more-populous city already owns this state → skip
  }

  return result
}

// --- Small UI helpers ---------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-cinzel text-[10px] font-semibold text-crusader-gold/45 tracking-[0.2em] uppercase mb-2.5">
      {children}
    </h3>
  )
}


// --- Page ---------------------------------------------------------------------

export default function MapCreatorPage() {
  const player = useAppStore((s) => s.player)

  // -- Globe interaction ---------------------------------------------------------
  const [selCountryIds, setSelCountryIds] = useState<number[]>([])
  const [selCountryFeats, setSelCountryFeats] = useState<GeoJSON.Feature[]>([])

  // -- Map metadata --------------------------------------------------------------
  const [meta, setMeta] = useState<MapMeta>({ name: '', desc: '' })
  const [zoneCount, setZoneCount] = useState(25)

  // -- Admin-1 subdivision data (for city deduplication) ------------------------
  const [admin1Features, setAdmin1Features] = useState<GeoJSON.Feature[] | null>(null)

  useEffect(() => {
    fetch('/admin1.json')
      .then((r) => r.json())
      .then((data) => {
        const fc = feature(data as any, (data as any).objects.admin1) as unknown as GeoJSON.FeatureCollection
        setAdmin1Features(fc.features)
      })
      .catch(() => setAdmin1Features([]))
  }, [])

  // -- World country features (for quick-select hot buttons) --------------------
  const [worldFeatureMap, setWorldFeatureMap] = useState<Map<number, GeoJSON.Feature>>(new Map())

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then((r) => r.json())
      .then((data: Topology) => {
        const countries = feature(data, data.objects.countries as GeometryCollection)
        const map = new Map<number, GeoJSON.Feature>()
        countries.features.forEach((f) => {
          const id = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number ?? 0)
          map.set(id, f)
        })
        setWorldFeatureMap(map)
      })
      .catch(console.error)
  }, [])

  // -- Generated output ----------------------------------------------------------
  const [generatedCities,      setGeneratedCities]      = useState<CityFull[]>([])
  const [generatedTerritories, setGeneratedTerritories] = useState<Territory[]>([])
  const [bonusGroups,          setBonusGroups]          = useState<BonusGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const markers: MarkerDef[] = useMemo(() => generatedCities.map((c, i) => ({
    id: `city-${i}`,
    lat: c.lat,
    lon: c.lon,
    label: c.name,
  })), [generatedCities])

  // -- Country toggle ------------------------------------------------------------
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
    setSelCountryIds([]); setSelCountryFeats([])
    setGeneratedCities([]); setGeneratedTerritories([]); setBonusGroups([]); setSavedId(null)
  }, [])

  // -- Quick-select: toggle a set of country ISO ids (continent or whole globe) -
  const handleQuickSelect = useCallback((ids: number[]) => {
    const idSet = new Set(ids)
    const allSelected = ids.every((id) => selCountryIds.includes(id))

    if (allSelected) {
      // Deselect all countries in this group
      setSelCountryIds((p) => p.filter((id) => !idSet.has(id)))
      setSelCountryFeats((p) => p.filter((f) => {
        const fid = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number)
        return !idSet.has(fid)
      }))
    } else {
      // Add any missing countries from this group
      const missing = ids.filter((id) => !selCountryIds.includes(id))
      const missingFeats = missing.flatMap((id) => {
        const f = worldFeatureMap.get(id)
        return f ? [f] : []
      })
      setSelCountryIds((p) => [...p, ...missing])
      setSelCountryFeats((p) => [...p, ...missingFeats])
    }
    setSavedId(null)
  }, [selCountryIds, worldFeatureMap])

  // -- Auto-generate zones when selection or count changes ---------------------
  useEffect(() => {
    if (selCountryIds.length === 0) {
      setGeneratedCities([])
      setGeneratedTerritories([])
      setBonusGroups([])
      return
    }

    // Always guarantee one zone per selected country at its capital.
    // Only add extra zones (largest cities) when zoneCount > countryCount.
    const capitals = getCapitalsForCountries(selCountryIds)
    const countryCount = selCountryIds.length

    let citiesToUse: CityFull[]
    if (zoneCount <= countryCount) {
      // One zone per country at the capital — no subdivision needed
      citiesToUse = capitals
    } else {
      // Capitals first, then fill remaining slots with top cities
      const capitalKey = (c: CityFull) => `${c.country}:${c.name}`
      const capitalKeys = new Set(capitals.map(capitalKey))
      const allCities = getCitiesForCountries(selCountryIds)
      const dedupedCities = admin1Features
        ? deduplicateCitiesBySubdivision(allCities, admin1Features)
        : allCities
      const additional = dedupedCities
        .filter((c) => !capitalKeys.has(capitalKey(c)))
        .slice(0, zoneCount - countryCount)
      citiesToUse = [...capitals, ...additional]
    }

    setGeneratedCities(citiesToUse)

    if (selCountryFeats.length === 0) {
      setGeneratedTerritories([])
      setBonusGroups([])
      setSavedId(null)
      return
    }

    // Generate Voronoi zones clipped to country boundaries
    const result = generateZonesFromCities(citiesToUse, selCountryFeats, citiesToUse.length)

    // Fix bonus group names (generateZonesFromCities uses placeholder names)
    const namedGroups: BonusGroup[] = result.bonusGroups.map((bg) => {
      const iso = parseInt(bg.id.replace('bonus-', ''))
      return { ...bg, name: getCountryName(iso) || bg.name }
    })

    setGeneratedTerritories(result.territories)
    setBonusGroups(namedGroups)
    setSavedId(null)
  }, [selCountryIds, selCountryFeats, zoneCount, admin1Features])

  // -- Save / Update -------------------------------------------------------------
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

      const regionName = selCountryIds.slice(0, 5).map(getCountryName).filter(Boolean).join(', ') +
        (selCountryIds.length > 5 ? ` +${selCountryIds.length - 5} more` : '')

      const payload = {
        name: meta.name.trim(),
        description: meta.desc.trim() || null,
        region_name: regionName || 'Custom Region',
        region_bounds: bounds,
        country_iso_ids: selCountryIds,
        territories: generatedTerritories,
        bonus_groups: bonusGroups,
      }

      const sb = getSupabaseClient()

      if (savedId) {
        // Already saved — update in place
        const { error } = await sb.from('battle_maps').update(payload).eq('id', savedId)
        if (error) throw error
      } else {
        // First save — insert
        const { data, error } = await sb.from('battle_maps').insert({
          ...payload,
          author_id: player.id,
          is_public: true,
        }).select('id').single()
        if (error) throw error
        setSavedId(data.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setSaveError(msg)
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }


  const canSave = !!player && meta.name.trim().length > 0 && generatedTerritories.length > 0

  // -- Quick-select button definitions ------------------------------------------
  const allCountryIds = useMemo(
    () => Object.values(CONTINENT_COUNTRIES).flat(),
    [],
  )
  const quickSelectGroups = useMemo(() => [
    { label: 'Entire Globe', ids: allCountryIds, span: true },
    { label: 'North America', ids: getContinentCountryIds('north-america'), span: false },
    { label: 'South America', ids: getContinentCountryIds('south-america'), span: false },
    { label: 'Europe',        ids: getContinentCountryIds('europe'),        span: false },
    { label: 'Asia',          ids: getContinentCountryIds('asia'),          span: false },
  ], [allCountryIds])

  return (
    <div className="h-screen bg-crusader-void flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-row overflow-hidden pt-20">

        {/* ── Globe ── */}
        <div className="flex-1 relative overflow-hidden bg-crusader-void">
          <EarthGlobe
            interactive
            autoRotate={false}
            selectionMode="multi-country"
            selectedIds={selCountryIds}
            onMultiCountryToggle={handleCountryToggle}
            markers={markers}
            territories={generatedTerritories}
            countryFeatures={selCountryFeats}
            className="absolute inset-0 w-full h-full"
          />

          {/* Zone count badge */}
          {generatedTerritories.length > 0 && (
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
          )}
        </div>

        {/* ── Right Panel ── */}
        <div
          className="w-80 xl:w-96 flex flex-col border-l border-crusader-gold/10"
          style={{ background: 'rgba(6,5,3,0.92)', backdropFilter: 'blur(12px)', height: '100%' }}
        >
          {/* Map Name — first thing at the top */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-crusader-gold/10">
            <h2 className="font-cinzel text-base font-bold text-crusader-gold mb-3">Map Creator</h2>
            <Input
              value={meta.name}
              onChange={(e) => { setMeta((m) => ({ ...m, name: e.target.value })); setSaveError(null) }}
              placeholder="Name your map..."
            />
            <p className="text-[10px] text-crusader-gold/30 font-cinzel mt-1.5">
              {selCountryIds.length > 0
                ? `${selCountryIds.length} region${selCountryIds.length !== 1 ? 's' : ''} selected · ${generatedTerritories.length} zones`
                : 'Select regions on the globe below'}
            </p>
          </div>

          {/* Quick Select */}
          <div className="shrink-0 px-5 pt-3 pb-3 border-b border-crusader-gold/8">
            <SectionHeader>Quick Select</SectionHeader>
            <div className="grid grid-cols-2 gap-1.5">
              {quickSelectGroups.map(({ label, ids, span }) => {
                const active = ids.length > 0 && ids.every((id) => selCountryIds.includes(id))
                const partial = !active && ids.some((id) => selCountryIds.includes(id))
                return (
                  <button
                    key={label}
                    onClick={() => handleQuickSelect(ids)}
                    disabled={worldFeatureMap.size === 0}
                    className={`
                      ${span ? 'col-span-2' : ''}
                      px-3 py-1.5 rounded-sm border font-cinzel text-[10px] tracking-wider
                      transition-colors text-left
                      ${active
                        ? 'bg-crusader-gold/20 border-crusader-gold/60 text-crusader-gold'
                        : partial
                          ? 'bg-crusader-gold/8 border-crusader-gold/30 text-crusader-gold/70'
                          : 'bg-crusader-dark/30 border-crusader-gold/15 text-crusader-gold/40 hover:border-crusader-gold/35 hover:text-crusader-gold/65'
                      }
                      disabled:opacity-30 disabled:cursor-not-allowed
                    `}
                  >
                    {label}
                    {partial && <span className="ml-1 opacity-60">·</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Zones slider */}
          <div className="shrink-0 px-5 pt-3 pb-3 border-b border-crusader-gold/8">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-cinzel text-crusader-gold/40 uppercase tracking-widest whitespace-nowrap">Zones</span>
              <input
                type="range" min={2} max={200} value={zoneCount}
                onChange={(e) => setZoneCount(Number(e.target.value))}
                className="flex-1 accent-crusader-gold cursor-pointer"
              />
              <span className="text-[11px] font-cinzel font-bold text-crusader-gold w-6 text-right">{zoneCount}</span>
            </div>
          </div>

          {/* Selected countries list — fills remaining space */}
          <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-none min-h-0">
            {selCountryIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Globe size={28} className="text-crusader-gold/20" />
                <p className="text-[11px] font-cinzel text-crusader-gold/30 leading-relaxed">
                  Use Quick Select above or zoom in<br />and click countries on the globe
                </p>
              </div>
            ) : (
              <>
                <SectionHeader>Selected Regions ({selCountryIds.length})</SectionHeader>
                <div className="space-y-0.5">
                  {selCountryIds.map((id) => (
                    <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-crusader-gold/5 transition-colors group">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-crusader-gold/40" />
                      <span className="text-[11px] text-crusader-gold/65 flex-1 truncate font-cinzel">
                        {getCountryName(id)}
                      </span>
                      <button
                        onClick={() => removeCountry(id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-crusader-gold/10 space-y-2" style={{ background: 'rgba(6,5,3,0.97)' }}>
            {selCountryIds.length > 0 && (
              <Button fullWidth size="sm" variant="outline" icon={<X size={13} />} onClick={clearAll}>
                Clear Selection
              </Button>
            )}

            {saveError && (
              <p className="text-[10px] text-red-400/85 font-cinzel text-center leading-relaxed">{saveError}</p>
            )}

            <Button
              fullWidth
              size="lg"
              disabled={!canSave || saving}
              loading={saving}
              onClick={handleSave}
              icon={<Save size={15} />}
            >
              {savedId ? 'Update Map' : 'Save & Publish Map'}
            </Button>

            {!player && (
              <p className="text-[10px] text-amber-400/60 text-center font-cinzel">Sign in to publish maps</p>
            )}
            {player && !meta.name.trim() && selCountryIds.length > 0 && (
              <p className="text-[10px] text-crusader-gold/25 text-center font-cinzel">Enter a map name to publish</p>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}

