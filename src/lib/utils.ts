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
