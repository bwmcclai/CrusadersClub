import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as THREE from 'three'
import { Delaunay } from 'd3-delaunay'
import type { Territory, BonusGroup } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Geo Math ─────────────────────────────────────────────────────────────────

export function latLonToVec3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  )
}

/** Mercator projection: lon/lat → pixel x/y given a viewport */
export function mercatorProject(
  lon: number,
  lat: number,
  width: number,
  height: number,
): [number, number] {
  const x = (lon + 180) / 360 * width
  const latRad = lat * Math.PI / 180
  const mercN  = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const y      = height / 2 - (width * mercN) / (2 * Math.PI)
  return [x, y]
}

// ─── Point-in-polygon (ray casting) ──────────────────────────────────────────

export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// ─── Territory Generation ─────────────────────────────────────────────────────

export interface GeneratedMap {
  territories: Territory[]
  bonusGroups: BonusGroup[]
}

export function generateTerritories(
  rings: [number, number][][],   // GeoJSON polygon rings in [lon, lat] order
  count: number,
  width = 800,
  height = 600,
): GeneratedMap {
  // Project rings to 2D
  const projectedRings: [number, number][][] = rings.map((ring) =>
    ring.map(([lon, lat]) => mercatorProject(lon, lat, width, height)),
  )

  const outerRing = projectedRings[0]

  // Bounding box of projected outer ring
  const xs = outerRing.map(([x]) => x)
  const ys = outerRing.map(([, y]) => y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  // Generate seeds inside polygon via rejection sampling
  const seeds: [number, number][] = []
  let attempts = 0
  while (seeds.length < count && attempts < count * 200) {
    attempts++
    const x = minX + Math.random() * (maxX - minX)
    const y = minY + Math.random() * (maxY - minY)
    if (pointInPolygon([x, y], outerRing)) {
      seeds.push([x, y])
    }
  }

  if (seeds.length < 3) return { territories: [], bonusGroups: [] }

  // Voronoi tessellation
  const delaunay = Delaunay.from(seeds)
  const voronoi  = delaunay.voronoi([minX - 1, minY - 1, maxX + 1, maxY + 1])

  // Build adjacency via Delaunay neighbors
  const adjacency: Set<number>[] = seeds.map(() => new Set())
  seeds.forEach((_, i) => {
    for (const j of Array.from(delaunay.neighbors(i))) {
      adjacency[i].add(j)
      adjacency[j].add(i)
    }
  })

  const territories: Territory[] = seeds.map((seed, i) => {
    const cell = voronoi.cellPolygon(i)
    const polygon: [number, number][] = cell
      ? (cell as [number, number][]).filter(([x, y]) =>
          pointInPolygon([x, y], outerRing),
        )
      : []

    return {
      id:           `t-${i}`,
      name:         `Territory ${i + 1}`,
      polygon,
      seed,
      adjacent_ids: Array.from(adjacency[i]).map((j) => `t-${j}`),
    }
  })

  // Auto-create a single bonus group from all territories
  const bonusGroups: BonusGroup[] = [
    {
      id:             'bg-0',
      name:           'Full Map',
      territory_ids:  territories.map((t) => t.id),
      bonus_armies:   Math.max(2, Math.floor(count / 3)),
    },
  ]

  return { territories, bonusGroups }
}

// ─── Zone Generation from GeoJSON Features (continent / globe modes) ──────────

export interface BonusGroupDef {
  id:         string
  name:       string
  featureIds: number[]   // ISO numeric codes of features in this group
  bonus:      number
}

/**
 * Generates Territory[] + BonusGroup[] from an array of GeoJSON country features.
 * Each feature becomes one territory (largest polygon ring is used for display).
 * Adjacency is derived from Delaunay triangulation of seed centroids.
 */
export function generateZonesFromFeatures(
  features: GeoJSON.Feature[],
  bonusDefs: BonusGroupDef[],
  width  = 1200,
  height =  600,
): GeneratedMap {
  if (features.length === 0) return { territories: [], bonusGroups: [] }

  // Project each feature to 2D
  const entries: { id: string; name: string; polygon: [number, number][]; seed: [number, number] }[] = []

  for (const feat of features) {
    const geo = feat.geometry
    if (!geo) continue

    // Pick the largest polygon ring
    let rings: number[][][] = []
    if (geo.type === 'Polygon') {
      rings = geo.coordinates as number[][][]
    } else if (geo.type === 'MultiPolygon') {
      const all = (geo.coordinates as number[][][][]).flat()
      all.sort((a, b) => b.length - a.length)
      rings = all
    }

    if (!rings.length) continue

    const projected: [number, number][] = rings[0].map(
      ([lon, lat]) => mercatorProject(lon, lat, width, height),
    )

    // Seed = bounding box centroid of the projected polygon
    const xs = projected.map(([x]) => x)
    const ys = projected.map(([, y]) => y)
    const seed: [number, number] = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ]

    const numId = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
    entries.push({ id: `z-${numId}`, name: `z-${numId}`, polygon: projected, seed })
  }

  if (entries.length === 0) return { territories: [], bonusGroups: [] }

  // Delaunay on seeds for adjacency
  const seeds  = entries.map((e) => e.seed)
  const delaunay = Delaunay.from(seeds)
  const adjacency: Set<number>[] = seeds.map(() => new Set())
  seeds.forEach((_, i) => {
    for (const j of Array.from(delaunay.neighbors(i))) {
      adjacency[i].add(j)
      adjacency[j].add(i)
    }
  })

  const territories: Territory[] = entries.map((e, i) => ({
    id:          e.id,
    name:        e.name,
    polygon:     e.polygon,
    seed:        e.seed,
    adjacent_ids: Array.from(adjacency[i]).map((j) => entries[j].id),
  }))

  // Build bonus groups: map feature ISO id → territory id
  const isoToTerritoryId = new Map<number, string>()
  features.forEach((feat, i) => {
    const numId = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
    if (entries[i]) isoToTerritoryId.set(numId, entries[i].id)
  })

  const bonusGroups: BonusGroup[] = bonusDefs.map((def) => ({
    id:            def.id,
    name:          def.name,
    territory_ids: def.featureIds
      .map((iso) => isoToTerritoryId.get(iso))
      .filter(Boolean) as string[],
    bonus_armies:  def.bonus,
  }))

  return { territories, bonusGroups }
}

// ─── City-based Zone Generation ──────────────────────────────────────────────
//
// Selects the top-N most-populated cities from a pre-filtered list,
// projects them to 2D, builds Voronoi cells clipped to the union of
// all selected country feature boundaries, then computes Delaunay adjacency.
//
// Returns one BonusGroup per country in the selection.

import type { CityFull } from './citiesData'

export interface CityZoneResult {
  territories: Territory[]
  bonusGroups: BonusGroup[]
  cityCount:   number   // actual number of cities found (may be < requested count)
}

export function generateZonesFromCities(
  cities:   CityFull[],        // pre-filtered to selected countries, sorted by pop desc
  features: GeoJSON.Feature[], // country features for boundary clipping
  count:    number,
  width  = 1200,
  height =  600,
): CityZoneResult {
  // Take the top-N cities across all selected countries
  const top = cities.slice(0, Math.max(2, count))
  if (top.length < 1) return { territories: [], bonusGroups: [], cityCount: 0 }

  // ── Build per-country lookups ────────────────────────────────────────────────

  // ISO → GeoJSON features
  const featsByIso = new Map<number, GeoJSON.Feature[]>()
  for (const feat of features) {
    const iso = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
    if (!featsByIso.has(iso)) featsByIso.set(iso, [])
    featsByIso.get(iso)!.push(feat)
  }

  // ISO → cities (preserving population-rank order within each country)
  const citiesByIso = new Map<number, CityFull[]>()
  for (const city of top) {
    if (!citiesByIso.has(city.country)) citiesByIso.set(city.country, [])
    citiesByIso.get(city.country)!.push(city)
  }

  // ── Generate Voronoi independently per country ───────────────────────────────

  const allTerritories: Territory[] = []
  const bonusGroups:    BonusGroup[] = []
  let globalIdx = 0  // keeps territory IDs unique across countries

  for (const [iso, countryCities] of Array.from(citiesByIso)) {
    const countryFeats = featsByIso.get(iso) ?? []
    // Use equirectangular projection — same coordinate space as the canvas clip
    // region (which is built from lon/lat via the same formula).  Mercator was
    // causing a coordinate-system mismatch that left uncovered gaps near country
    // borders, especially at high latitudes where Mercator distorts most.
    const equiProj = (lon: number, lat: number): [number, number] => [
      (lon + 180) / 360 * width,
      (90  - lat) / 180 * height,
    ]

    const seeds: [number, number][] = countryCities.map(
      (c) => equiProj(c.lon, c.lat),
    )

    // Bounding box from this country's projected boundary rings
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const feat of countryFeats) {
      const geo = feat.geometry
      if (!geo) continue
      const outerRings: number[][][] =
        geo.type === 'Polygon'      ? [geo.coordinates[0] as number[][]] :
        geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).map((p) => p[0]) :
        []
      for (const ring of outerRings) {
        for (const [lon, lat] of ring) {
          const [x, y] = equiProj(lon, lat)
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }

    // Fall back to seed bounding box if no features available
    if (!isFinite(minX)) {
      for (const [x, y] of seeds) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }

    const pad = 20
    const bbox: [number, number, number, number] = [
      minX - pad, minY - pad, maxX + pad, maxY + pad,
    ]

    const startIdx = globalIdx

    if (seeds.length === 1) {
      // Only one city in this country — give it a marker polygon
      allTerritories.push({
        id:           `city-${globalIdx}`,
        name:         countryCities[0].name,
        polygon:      makeMarkerPolygon(seeds[0], 8),
        seed:         seeds[0],
        adjacent_ids: [],
        bonus_group:  `bonus-${iso}`,
      })
      globalIdx++
    } else {
      // Voronoi for this country's cities only
      const delaunay = Delaunay.from(seeds)
      const voronoi  = delaunay.voronoi(bbox)

      const adjacency: Set<number>[] = seeds.map(() => new Set())
      seeds.forEach((_, i) => {
        for (const j of Array.from(delaunay.neighbors(i))) {
          adjacency[i].add(j)
          adjacency[j].add(i)
        }
      })

      for (let i = 0; i < countryCities.length; i++) {
        const cell = voronoi.cellPolygon(i)
        const polygon: [number, number][] = cell
          ? (cell as [number, number][])
          : makeMarkerPolygon(seeds[i], 8)

        allTerritories.push({
          id:           `city-${globalIdx}`,
          name:         countryCities[i].name,
          polygon,
          seed:         seeds[i],
          adjacent_ids: Array.from(adjacency[i]).map((j) => `city-${startIdx + j}`),
          bonus_group:  `bonus-${iso}`,
        })
        globalIdx++
      }
    }

    const ids = allTerritories.slice(startIdx).map((t) => t.id)
    bonusGroups.push({
      id:            `bonus-${iso}`,
      name:          `Country ${iso}`,   // caller renames with getCountryName(iso)
      territory_ids: ids,
      bonus_armies:  Math.max(2, Math.round(ids.length / 3)),
    })
  }

  return { territories: allTerritories, bonusGroups, cityCount: top.length }
}

/** Small 8-point polygon (octagon) around a point — used as a fallback marker */
function makeMarkerPolygon(center: [number, number], r: number): [number, number][] {
  const [cx, cy] = center
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number]
  })
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function formatMode(mode: string): string {
  switch (mode) {
    case 'lightning':  return '⚡ Lightning (1 min/turn)'
    case 'slow_hour':  return '⏱ Slow (1 hr/turn)'
    case 'slow_day':   return '📅 Slow (1 day/turn)'
    default:           return mode
  }
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
