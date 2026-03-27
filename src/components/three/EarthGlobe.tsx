'use client'
import {
  useRef, useEffect, useState, useMemo, useCallback, Suspense
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { feature, mesh } from 'topojson-client'
import { geoContains } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import {
  type ContinentId,
  getCountryName,
  getContinent,
  getContinentCountryIds,
  CONTINENT_INFO,
} from '@/lib/geoData'
import type { Territory } from '@/types'

// ─── Zone Overlay Palette ─────────────────────────────────────────────────────
// One distinct color per territory (NCAA-style: each city gets its own colour)

const ZONE_PALETTE = [
  '#C94040', '#3A7EC5', '#2E8B57', '#D4A843', '#7B4C96',
  '#2E8B8B', '#C96C30', '#8C3E8C', '#4C8C4C', '#3E6B8C',
  '#8C5A3E', '#5A3E8C', '#3E8C6B', '#8C3E5A', '#6B8C3E',
  '#8C7A3E', '#3E5A8C', '#8C4C3E', '#5A8C3E', '#8C3E6B',
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function latLonToVec3(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

function vec3ToLatLon(p: THREE.Vector3): [number, number] {
  const n   = p.clone().normalize()
  const lat = Math.asin(n.y) * (180 / Math.PI)
  let   lon = Math.atan2(n.z, -n.x) * (180 / Math.PI) - 180
  if (lon < -180) lon += 360
  if (lon >  180) lon -= 360
  return [lat, lon]
}

function ringToPoints(ring: number[][], r = 1.002): THREE.Vector3[] {
  return ring.map(([lon, lat]) => latLonToVec3(lat, lon, r))
}

/** Inverse Mercator — pixel (x,y) at projection size w×h → [lon, lat] */
function invMercator(x: number, y: number, w = 1200, h = 600): [number, number] {
  const lon   = x * 360 / w - 180
  const mercN = (h / 2 - y) * (2 * Math.PI) / w
  const lat   = (2 * Math.atan(Math.exp(mercN)) - Math.PI / 2) * (180 / Math.PI)
  return [lon, lat]
}

// ─── Polygon Utilities ────────────────────────────────────────────────────────

/**
 * Chaikin's corner-cutting — converts hard Voronoi edges into smooth organic
 * curves.  Each pass replaces every edge with two points at ¼ and ¾ along it,
 * effectively rounding every corner.  4 passes is visually ideal for zone maps.
 */
function chaikinSmooth(pts: [number, number][], iterations = 4): [number, number][] {
  let p = pts
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = []
    const n = p.length
    for (let i = 0; i < n; i++) {
      const [x0, y0] = p[i]
      const [x1, y1] = p[(i + 1) % n]
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    p = next
  }
  return p
}

/** Shoelace area (always positive) */
function polyArea(pts: [number, number][]): number {
  let a = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % n]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}

/** Weighted centroid via shoelace formula */
function polyCentroid(pts: [number, number][]): [number, number] {
  let cx = 0, cy = 0, area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % n]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx   += (x0 + x1) * cross
    cy   += (y0 + y1) * cross
  }
  area /= 2
  if (Math.abs(area) < 0.001) {
    const mx = pts.reduce((s, [x]) => s + x, 0) / n
    const my = pts.reduce((s, [, y]) => s + y, 0) / n
    return [mx, my]
  }
  return [cx / (6 * area), cy / (6 * area)]
}

/** PCA principal-axis angle for label orientation (radians) */
function polyAngle(pts: [number, number][]): number {
  const n = pts.length
  let mx = 0, my = 0
  for (const [x, y] of pts) { mx += x; my += y }
  mx /= n; my /= n
  let cxx = 0, cyy = 0, cxy = 0
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy
  }
  return 0.5 * Math.atan2(2 * cxy, cxx - cyy)
}

/** Extent of polygon projected onto a given angle (for font-size fitting) */
function polySpan(pts: [number, number][], angle: number): number {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  let lo = Infinity, hi = -Infinity
  for (const [x, y] of pts) {
    const proj = x * cos + y * sin
    if (proj < lo) lo = proj
    if (proj > hi) hi = proj
  }
  return hi - lo
}

// ─── Zone Overlays ────────────────────────────────────────────────────────────
// Primary rendering strategy — subdivision-based zone fills:
//   1. Load Natural Earth admin-1 (states/provinces) from /admin1.json lazily
//   2. Assign each subdivision to the nearest territory seed (Voronoi in equirectangular)
//   3. Fill each subdivision with its zone colour → borders ARE political boundaries
//   4. Draw all subdivision outlines in gold
//   5. Labels drawn at city seed positions
//
// Fallback (admin-1 not yet loaded, or country has no subdivisions):
//   Use equirectangular Voronoi fill with Chaikin-smoothed borders.

type Admin1Feature = GeoJSON.Feature & {
  properties: { name: string; iso_n3: number; clon: number; clat: number }
}

function ZoneOverlays({
  territories,
  countryFeatures = [],
}: {
  territories:     Territory[]
  countryFeatures: GeoJSON.Feature[]
}) {
  // Raw TopoJSON stored so mesh() can query arc-level adjacency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [admin1Topo, setAdmin1Topo] = useState<Record<string, any> | null>(null)

  // GeoJSON features derived from topology (stable reference, no extra fetch)
  const admin1 = useMemo<Admin1Feature[]>(() => {
    if (!admin1Topo) return []
    const fc = feature(admin1Topo as any, admin1Topo.objects.admin1) as unknown as GeoJSON.FeatureCollection
    return fc.features as Admin1Feature[]
  }, [admin1Topo])

  useEffect(() => {
    if (territories.length === 0) return
    if (admin1Topo) return    // already loaded
    fetch('/admin1.json')
      .then((r) => r.json())
      .then(setAdmin1Topo)
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories.length])

  const texture = useMemo(() => {
    if (territories.length === 0) return null

    const W = 4096, H = 2048
    const canvas = document.createElement('canvas')
    canvas.width  = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // ── Coordinate helpers ────────────────────────────────────────────────────

    // lon/lat → canvas pixel (equirectangular)
    const lonLatToCanvas = (lon: number, lat: number): [number, number] => [
      (lon + 180) / 360 * W,
      (90  - lat) / 180 * H,
    ]

    // Voronoi equirectangular base (1200×600) → canvas pixel
    const SX = W / 1200, SY = H / 600
    const equiToCanvas = (polygon: [number, number][]): [number, number][] =>
      polygon.map(([ex, ey]) => [ex * SX, ey * SY] as [number, number])

    // ── Canvas path helpers ───────────────────────────────────────────────────

    const tracePts = (pts: [number, number][]) => {
      ctx.beginPath()
      pts.forEach(([px, py], j) => j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
      ctx.closePath()
    }

    // Trace a GeoJSON geometry (Polygon|MultiPolygon) directly from lon/lat
    const traceGeo = (geo: GeoJSON.Geometry) => {
      ctx.beginPath()
      const rings: number[][][] =
        geo.type === 'Polygon'      ? geo.coordinates as number[][][] :
        geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() :
        []
      for (const ring of rings) {
        ring.forEach(([lon, lat], j) => {
          const [px, py] = lonLatToCanvas(lon, lat)
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        })
        ctx.closePath()
      }
    }

    // Clip canvas to country boundary features
    const applyClip = (feats: GeoJSON.Feature[]) => {
      ctx.beginPath()
      for (const feat of feats) {
        if (!feat.geometry) continue
        const rings: number[][][] =
          feat.geometry.type === 'Polygon'      ? feat.geometry.coordinates as number[][][] :
          feat.geometry.type === 'MultiPolygon' ? (feat.geometry.coordinates as number[][][][]).flat() :
          []
        for (const ring of rings) {
          ring.forEach(([lon, lat], j) => {
            const [px, py] = lonLatToCanvas(lon, lat)
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          })
          ctx.closePath()
        }
      }
      ctx.clip('evenodd')
    }

    // ── Pre-computations ──────────────────────────────────────────────────────

    // Lookup: bonus-group key → country boundary features
    const featsByGroup = new Map<string, GeoJSON.Feature[]>()
    for (const feat of countryFeatures) {
      const iso = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
      const key = `bonus-${iso}`
      if (!featsByGroup.has(key)) featsByGroup.set(key, [])
      featsByGroup.get(key)!.push(feat)
    }

    // Group territories by country, preserving global palette index
    const byCountry = new Map<string, { territory: Territory; gi: number }[]>()
    territories.forEach((t, gi) => {
      const key = t.bonus_group ?? '__all__'
      if (!byCountry.has(key)) byCountry.set(key, [])
      byCountry.get(key)!.push({ territory: t, gi })
    })

    // Voronoi polygons as raw canvas pts (for Voronoi fallback + labels)
    const rawMap = new Map<string, [number, number][]>()
    territories.forEach((t) => {
      if (!t.polygon || t.polygon.length < 3) return
      rawMap.set(t.id, equiToCanvas(t.polygon))
    })

    // Lookup: iso_n3 → admin1 features for that country
    const admin1ByIso = new Map<number, Admin1Feature[]>()
    for (const f of admin1) {
      const iso = f.properties?.iso_n3
      if (!iso) continue
      if (!admin1ByIso.has(iso)) admin1ByIso.set(iso, [])
      admin1ByIso.get(iso)!.push(f)
    }

    // Assign a subdivision centroid to the nearest territory seed (equirectangular)
    // Territory seeds are stored in base equirectangular 1200×600 space.
    const assignZone = (entries: { territory: Territory; gi: number }[], clon: number, clat: number): number => {
      const cx = (clon + 180) / 360 * 1200
      const cy = (90   - clat) / 180 * 600
      let bestGi = entries[0].gi, bestD = Infinity
      for (const { territory, gi } of entries) {
        const [sx, sy] = territory.seed
        const d = (sx - cx) ** 2 + (sy - cy) ** 2
        if (d < bestD) { bestD = d; bestGi = gi }
      }
      return bestGi
    }

    // ── Render each country group ─────────────────────────────────────────────
    for (const [key, entries] of Array.from(byCountry)) {
      const feats  = featsByGroup.get(key) ?? (key === '__all__' ? countryFeatures : [])
      const isoNum = parseInt(key.replace('bonus-', ''))
      const subdivs = admin1ByIso.get(isoNum) ?? []

      ctx.save()
      if (feats.length > 0) applyClip(feats)

      // Zone label anchors: visual centroid of the zone's actual area.
      // Populated differently in each branch below (subdivision vs Voronoi).
      // Key = palette index (gi), value = canvas [x, y].
      const zoneLabelPos = new Map<number, [number, number]>()

      if (subdivs.length > 0 && admin1Topo) {
        // ── SUBDIVISION MODE: each state/province gets its zone colour ──────────

        // Pre-compute zone gi for every subdivision in this country (by feature id)
        const subdivZoneMap = new Map<string, number>()
        for (const sub of subdivs) {
          const gi = assignZone(entries, sub.properties.clon, sub.properties.clat)
          subdivZoneMap.set(String(sub.id), gi)
        }

        // Compute each zone's visual centroid as the area-weighted mean of its
        // subdivisions' precomputed lon/lat centroids.  Using subdivision area
        // (from NE's area_sqkm approximation) would be ideal, but the precomputed
        // clon/clat centroids are sufficient — we weight by 1 per subdivision.
        // Accumulator: gi → { sumX, sumY, count }
        const centAcc = new Map<number, { sx: number; sy: number; n: number }>()
        for (const sub of subdivs) {
          const gi = subdivZoneMap.get(String(sub.id))
          if (gi === undefined) continue
          const cx = (sub.properties.clon + 180) / 360 * W
          const cy = (90 - sub.properties.clat) / 180 * H
          const acc = centAcc.get(gi) ?? { sx: 0, sy: 0, n: 0 }
          centAcc.set(gi, { sx: acc.sx + cx, sy: acc.sy + cy, n: acc.n + 1 })
        }
        for (const [gi, { sx, sy, n }] of Array.from(centAcc)) {
          zoneLabelPos.set(gi, [sx / n, sy / n])
        }

        // Pass 1 — fills: colour every subdivision by its nearest city
        for (const sub of subdivs) {
          if (!sub.geometry) continue
          const gi = subdivZoneMap.get(String(sub.id)) ?? entries[0].gi
          traceGeo(sub.geometry)
          ctx.fillStyle = ZONE_PALETTE[gi % ZONE_PALETTE.length] + 'CC'
          ctx.fill('evenodd')
        }

        // Build a MultiLineString of ONLY the arcs that separate two different
        // zones (a !== b and different gi).  Same-zone internal borders are
        // skipped — they would add clutter without conveying zone information.
        const zoneBorders = mesh(
          admin1Topo as any,
          admin1Topo.objects.admin1,
          (a: any, b: any) => {
            if (a === b) return false          // exterior arc — skip
            if ((a.properties?.iso_n3 ?? 0) !== isoNum) return false
            if ((b.properties?.iso_n3 ?? 0) !== isoNum) return false
            const gA = subdivZoneMap.get(String(a.id))
            const gB = subdivZoneMap.get(String(b.id))
            return gA !== undefined && gB !== undefined && gA !== gB
          },
        )

        // Trace the zone-boundary mesh as a single path (MultiLineString)
        const traceZoneBorders = () => {
          ctx.beginPath()
          if (zoneBorders.type === 'MultiLineString') {
            for (const line of zoneBorders.coordinates as unknown as number[][][]) {
              line.forEach(([lon, lat], j) => {
                const [px, py] = lonLatToCanvas(lon, lat)
                j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
              })
            }
          } else if (zoneBorders.type === 'LineString') {
            ;(zoneBorders.coordinates as unknown as number[][]).forEach(([lon, lat], j) => {
              const [px, py] = lonLatToCanvas(lon, lat)
              j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
            })
          }
        }

        // Pass 2 — glow only on zone-boundary arcs
        ctx.save()
        ctx.filter      = 'blur(6px)'
        ctx.lineJoin    = 'round'
        ctx.lineCap     = 'round'
        traceZoneBorders()
        ctx.strokeStyle = 'rgba(255, 228, 130, 0.35)'
        ctx.lineWidth   = 14
        ctx.stroke()
        ctx.restore()

        // Pass 3 — crisp gold line only on zone-boundary arcs
        ctx.lineJoin    = 'round'
        ctx.lineCap     = 'round'
        traceZoneBorders()
        ctx.strokeStyle = 'rgba(215, 175, 60, 0.92)'
        ctx.lineWidth   = 3
        ctx.stroke()

      } else {
        // ── VORONOI FALLBACK: for countries with no admin-1 data ───────────────

        // Voronoi centroid = visual center of the Voronoi cell
        entries.forEach(({ territory, gi }: { territory: Territory; gi: number }) => {
          const pts = rawMap.get(territory.id)
          if (pts) zoneLabelPos.set(gi, polyCentroid(pts))
        })

        // Pass 1 — raw Voronoi fills (space-filling, no gaps)
        entries.forEach(({ territory, gi }: { territory: Territory; gi: number }) => {
          const pts = rawMap.get(territory.id)
          if (!pts) return
          tracePts(pts)
          ctx.fillStyle = ZONE_PALETTE[gi % ZONE_PALETTE.length] + 'CC'
          ctx.fill()
        })

        // Pass 2 — glow
        ctx.save()
        ctx.filter   = 'blur(5px)'
        ctx.lineJoin = 'round'
        entries.forEach(({ territory }: { territory: Territory; gi: number }) => {
          const pts = rawMap.get(territory.id)
          if (!pts) return
          tracePts(chaikinSmooth(pts, 4))
          ctx.strokeStyle = 'rgba(255, 228, 130, 0.28)'
          ctx.lineWidth   = 14
          ctx.stroke()
        })
        ctx.restore()

        // Pass 3 — crisp border
        entries.forEach(({ territory }: { territory: Territory; gi: number }) => {
          const pts = rawMap.get(territory.id)
          if (!pts) return
          tracePts(chaikinSmooth(pts, 4))
          ctx.strokeStyle = 'rgba(215, 175, 60, 0.90)'
          ctx.lineWidth   = 3.5
          ctx.lineJoin    = 'round'
          ctx.stroke()
        })
      }

      // ── Pass 4 — zone labels at zone visual centroid ────────────────────────
      entries.forEach(({ territory, gi }: { territory: Territory; gi: number }) => {
        // Use the zone's visual centroid (avg of subdivision centroids in
        // subdivision mode, or Voronoi centroid in fallback mode).
        // Fall back to city seed only if nothing else is available.
        const labelPos = zoneLabelPos.get(gi)
          ?? [territory.seed[0] * SX, territory.seed[1] * SY] as [number, number]
        const [lx, ly] = labelPos

        // Estimate zone size + orientation from the Voronoi polygon — it gives
        // a reasonable bounding shape even when fills come from subdivisions.
        const pts  = rawMap.get(territory.id)
        const area = pts ? polyArea(pts) : 0
        if (area < 1200) return

        const rawAngle  = pts ? polyAngle(pts) : 0
        const drawAngle = ((rawAngle % Math.PI) + Math.PI * 1.5) % Math.PI - Math.PI / 2
        const span      = pts ? polySpan(pts, drawAngle) : 0

        const fontSize    = Math.min(Math.max(Math.sqrt(area) * 0.065, 12), 52)
        const name        = territory.name
        const approxTextW = name.length * fontSize * 0.55
        if (span < approxTextW * 0.65) return

        ctx.save()
        ctx.translate(lx, ly)
        ctx.rotate(drawAngle)

        ctx.font         = `italic ${Math.round(fontSize)}px 'Palatino Linotype', Palatino, Georgia, serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor  = 'rgba(255, 255, 255, 0.6)'
        ctx.shadowBlur   = fontSize * 0.7
        ctx.fillStyle    = 'rgba(20, 12, 4, 0.88)'
        ctx.fillText(name, 0, 0)
        ctx.shadowBlur   = 0
        ctx.fillStyle    = 'rgba(35, 20, 8, 0.82)'
        ctx.fillText(name, 0, 0)

        ctx.restore()
      })

      ctx.restore()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.anisotropy  = 16
    tex.needsUpdate = true
    return tex
  }, [territories, countryFeatures, admin1, admin1Topo])

  useEffect(() => { return () => { texture?.dispose() } }, [texture])

  if (!texture) return null

  return (
    <mesh>
      <sphereGeometry args={[1.002, 256, 256]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

// ─── Atmosphere Shader ────────────────────────────────────────────────────────
// Blue Fresnel glow — mimics Earth's atmospheric limb from orbit

const atmosphereVertexShader = /* glsl */`
  varying float intensity;
  void main() {
    vec3 n   = normalize(normalMatrix * normal);
    vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vec3 eye = normalize(-pos);
    intensity = pow(1.0 - abs(dot(n, eye)), 1.8);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = /* glsl */`
  varying float intensity;
  void main() {
    // Realistic blue atmosphere with slight teal tint at limb
    vec3 inner = vec3(0.15, 0.45, 1.0);
    vec3 outer = vec3(0.05, 0.20, 0.65);
    vec3 color = mix(inner, outer, intensity);
    gl_FragColor = vec4(color * intensity, intensity * 0.75);
  }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function EarthMesh() {
  const texture = useTexture('/earth.jpg')

  // Clone the texture for bump mapping so we can set it to linear color space
  // (brightness in the satellite image approximates terrain elevation well enough:
  //  bright snow/rock caps = raised, dark oceans = sunken)
  const bumpTex = useMemo(() => {
    const t = texture.clone()
    t.colorSpace = THREE.NoColorSpace
    t.needsUpdate = true
    return t
  }, [texture])

  return (
    <mesh>
      <sphereGeometry args={[1, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        bumpMap={bumpTex}
        bumpScale={0.05}
        roughness={0.85}
        metalness={0.05}
        color="#c8d4e8"
      />
    </mesh>
  )
}

function Atmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    side:           THREE.FrontSide,
  }), [])
  return (
    <mesh scale={1.12} material={material}>
      <sphereGeometry args={[1, 48, 48]} />
    </mesh>
  )
}

// Subtle inner glow on the dark side of the globe
function DarkSideGlow() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: /* glsl */`
      varying float intensity;
      void main() {
        vec3 color = vec3(0.02, 0.05, 0.15);
        gl_FragColor = vec4(color, intensity * 0.3);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.NormalBlending,
    side:        THREE.BackSide,
  }), [])
  return (
    <mesh scale={1.005} material={material}>
      <sphereGeometry args={[1, 32, 32]} />
    </mesh>
  )
}

// ─── Zoom Tracker ──────────────────────────────────────────────────────────────

function ZoomTracker({ onZoomChange }: { onZoomChange: (distance: number) => void }) {
  const { camera } = useThree()
  const lastDistRef = useRef(-1)

  useFrame(() => {
    const d = camera.position.length()
    if (Math.abs(d - lastDistRef.current) > 0.06) {
      lastDistRef.current = d
      onZoomChange(d)
    }
  })

  return null
}

// ─── Country Borders + Click Detection ────────────────────────────────────────

interface CountryBordersProps {
  features:         GeoJSON.Feature[]
  featureMap:       Map<number, GeoJSON.Feature>
  selectionMode:    'none' | 'continent' | 'multi-country'
  selectedIds:      number[]
  interactable:     boolean
  onHoverChange:    (id: number | null, name: string | null, continent: ContinentId | null) => void
  onContinentClick: (continent: ContinentId, countryIds: number[], features: GeoJSON.Feature[]) => void
  onCountryClick:   (id: number, name: string, feat: GeoJSON.Feature) => void
}

function CountryBorders({
  features, featureMap, selectionMode, selectedIds,
  interactable, onHoverChange, onContinentClick, onCountryClick,
}: CountryBordersProps) {
  const meshRef        = useRef<THREE.Mesh>(null!)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const lastHoverRef   = useRef<number | null>(null)
  const throttleRef    = useRef(0)

  // Border segments with continent info, built once
  const borderSegments = useMemo(() => {
    return features.flatMap((feat) => {
      const geo = feat.geometry
      if (!geo) return []
      const rings: number[][][] =
        geo.type === 'Polygon'      ? geo.coordinates as number[][][] :
        geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() :
        []
      const id = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
      return rings.map((ring) => ({
        points:      ringToPoints(ring),
        id,
        continentId: getContinent(id),
      }))
    })
  }, [features])

  const hoveredRef = useRef<{ id: number; continent: ContinentId | null } | null>(null)

  const pickMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide,
  }), [])

  const hitToFeature = useCallback((point: THREE.Vector3) => {
    const [lat, lon] = vec3ToLatLon(point)
    for (const feat of features) {
      if (geoContains(feat as any, [lon, lat])) return feat
    }
    return null
  }, [features])

  const handlePointerDown = useCallback((e: any) => {
    const ev = e as { clientX: number; clientY: number }
    pointerDownRef.current = { x: ev.clientX, y: ev.clientY }
  }, [])

  const handlePointerMove = useCallback((e: any) => {
    if (!interactable) return
    const now = performance.now()
    if (now - throttleRef.current < 40) return
    throttleRef.current = now

    const ev = e as THREE.Intersection & { point: THREE.Vector3 }
    const feat = hitToFeature(ev.point)
    if (!feat) {
      if (lastHoverRef.current !== null) {
        lastHoverRef.current = null
        hoveredRef.current = null
        onHoverChange(null, null, null)
      }
      return
    }
    const id = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
    if (id === lastHoverRef.current) return
    lastHoverRef.current = id
    const continent = getContinent(id)
    hoveredRef.current = { id, continent }
    onHoverChange(id, getCountryName(id), continent)
  }, [interactable, hitToFeature, onHoverChange])

  const handleClick = useCallback((e: any) => {
    if (!interactable) return
    const ev = e as { clientX: number; clientY: number } & { point: THREE.Vector3 }
    if (pointerDownRef.current) {
      const dx = ev.clientX - pointerDownRef.current.x
      const dy = ev.clientY - pointerDownRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 4) return
    }

    const feat = hitToFeature(ev.point)
    if (!feat) return
    const id = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
    const name = getCountryName(id)
    const continent = getContinent(id)

    if (selectionMode === 'continent' && continent) {
      const ids = getContinentCountryIds(continent)
      const feats = ids.map((iso) => featureMap.get(iso)).filter(Boolean) as GeoJSON.Feature[]
      onContinentClick(continent, ids, feats)
    } else {
      onCountryClick(id, name, feat)
    }
  }, [interactable, hitToFeature, selectionMode, featureMap, onContinentClick, onCountryClick])

  const hovered = hoveredRef.current

  return (
    <>
      <mesh
        ref={meshRef}
        material={pickMaterial}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <sphereGeometry args={[1.001, 64, 64]} />
      </mesh>

      {borderSegments.map((seg, i) => {
        const isSelected      = selectedIds.includes(seg.id)
        const isHoveredCont   = selectionMode === 'continent'
          && hovered?.continent != null
          && seg.continentId === hovered.continent
        const isHoveredCountry = hovered?.id === seg.id

        let color: string
        let lw: number

        if (isSelected) {
          color = '#D4A843'   // warm gold for selected
          lw    = 2.2
        } else if (isHoveredCont) {
          color = '#F0D88A'   // bright gold for continent hover
          lw    = 1.8
        } else if (isHoveredCountry) {
          color = '#E8CC70'   // gold for country hover
          lw    = 1.6
        } else {
          color = '#4a6480'   // muted blue-gray baseline (shows up against dark earth)
          lw    = 0.6
        }

        return (
          <Line key={i} points={seg.points} color={color} lineWidth={lw} />
        )
      })}
    </>
  )
}

// ─── Continent Labels ─────────────────────────────────────────────────────────

function ContinentLabels({
  hoveredContinent,
  selectedContinent,
  selectionMode,
}: {
  hoveredContinent:  ContinentId | null
  selectedContinent: ContinentId | null
  selectionMode:     'none' | 'continent' | 'multi-country'
}) {
  return (
    <>
      {(Object.entries(CONTINENT_INFO) as [ContinentId, typeof CONTINENT_INFO[ContinentId]][]).map(([id, info]) => {
        const pos      = latLonToVec3(info.centroid[1], info.centroid[0], 1.18)
        const isActive = id === hoveredContinent || id === selectedContinent
        const isContinentMode = selectionMode === 'continent'

        return (
          <Html key={id} position={pos} center occlude distanceFactor={3}>
            <div
              className={`pointer-events-none select-none transition-all duration-300 ${
                isActive          ? 'opacity-100 scale-110' :
                isContinentMode   ? 'opacity-55 scale-100' :
                                    'opacity-25 scale-95'
              }`}
            >
              <span
                style={{
                  color:      isActive ? info.color : '#C9A84C',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
                  letterSpacing: '0.12em',
                }}
                className="font-cinzel font-bold text-xs whitespace-nowrap uppercase"
              >
                {info.label}
              </span>
            </div>
          </Html>
        )
      })}
    </>
  )
}

// ─── City Zone Markers ────────────────────────────────────────────────────────

export interface MarkerDef {
  id:    string
  lat:   number
  lon:   number
  label: string
}

function CityMarkers({ markers }: { markers: MarkerDef[] }) {
  const { camera } = useThree()
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const texture = useTexture('/FlagMarker.png')

  // Pre-compute positions to avoid doing it every frame
  const positions = useMemo(() => markers.map(m => latLonToVec3(m.lat, m.lon, 1.006)), [markers])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!meshRef.current) return

    positions.forEach((pos, i) => {
      dummy.position.copy(pos)
      
      // Billboard: face the camera
      dummy.lookAt(camera.position)
      
      // Scale based on hover
      const s = hoveredIdx === i ? 0.045 : 0.03
      dummy.scale.set(s, s, s)
      
      // Check visibility (occlusion by earth)
      const dot = pos.clone().normalize().dot(camera.position.clone().normalize())
      if (dot < 0.2) { // Hidden or near the edge
        dummy.scale.set(0, 0, 0)
      }

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  const handlePointerMove = (e: any) => {
    e.stopPropagation()
    if (e.instanceId !== undefined) {
      setHoveredIdx(e.instanceId)
    }
  }

  const handlePointerOut = () => {
    setHoveredIdx(null)
  }

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, markers.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* Single label for hovered item — zoom-reactive via distanceFactor */}
      {hoveredIdx !== null && markers[hoveredIdx] && (
        <Html
          position={positions[hoveredIdx]}
          center
          distanceFactor={2.2}
          occlude={false}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {/* Offset upward so label sits just above the marker icon */}
          <div style={{ transform: 'translateY(-28px)' }}>
            <div
              className="border border-crusader-gold/30 rounded-sm backdrop-blur-sm whitespace-nowrap"
              style={{
                background:  'rgba(5,4,2,0.85)',
                padding:     '2px 6px',
                boxShadow:   '0 1px 8px rgba(0,0,0,0.7)',
              }}
            >
              <span
                className="font-cinzel text-crusader-gold/90 tracking-widest uppercase"
                style={{ fontSize: '7px', letterSpacing: '0.15em' }}
              >
                {markers[hoveredIdx].label}
              </span>
            </div>
          </div>
        </Html>
      )}
    </>
  )
}

// ─── Public Interface ─────────────────────────────────────────────────────────

export interface EarthGlobeProps {
  interactive?:          boolean
  autoRotate?:           boolean
  selectionMode?:        'none' | 'continent' | 'multi-country'
  selectedIds?:          number[]
  onContinentSelect?:    (continent: ContinentId, countryIds: number[], features: GeoJSON.Feature[]) => void
  onMultiCountryToggle?: (id: number, name: string, feature: GeoJSON.Feature) => void
  onCountrySelect?:      (id: number, name: string, feature: GeoJSON.Feature) => void
  onZoomChange?:         (distance: number) => void
  markers?:              MarkerDef[]
  /** When provided, renders coloured Voronoi zone meshes on the globe surface */
  territories?:          Territory[]
  /** GeoJSON features of the selected countries — used to clip zone rendering */
  countryFeatures?:      GeoJSON.Feature[]
  focusLatLon?:          [number, number]
  className?:            string
}

export default function EarthGlobe({
  interactive    = true,
  autoRotate     = false,
  selectionMode  = 'none',
  selectedIds    = [],
  onContinentSelect,
  onMultiCountryToggle,
  onCountrySelect,
  onZoomChange,
  markers        = [],
  territories    = [],
  countryFeatures = [],
  focusLatLon,
  className      = 'w-full h-full',
}: EarthGlobeProps) {
  const [worldData, setWorldData]       = useState<Topology | null>(null)
  const [hovered, setHovered]           = useState<{ id: number; name: string; continent: ContinentId | null } | null>(null)
  const [hoveredContinent, setHovCont]  = useState<ContinentId | null>(null)
  const [selectedContinent, setSelCont] = useState<ContinentId | null>(null)

  const [hiresData, setHiresData] = useState<Topology | null>(null)

  useEffect(() => {
    // Load 50m data immediately for fast initial render
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then((r) => r.json())
      .then((data: Topology) => {
        setWorldData(data)
        // Then load 10m in background for sharper borders at close zoom
        return fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json')
      })
      .then((r) => r.json())
      .then((data: Topology) => setHiresData(data))
      .catch(console.error)
  }, [])

  const activeData = hiresData ?? worldData

  const { features, featureMap } = useMemo(() => {
    if (!activeData) return { features: [], featureMap: new Map() }
    const countries = feature(activeData, activeData.objects.countries as GeometryCollection)
    const feats = countries.features
    const map = new Map<number, GeoJSON.Feature>()
    feats.forEach((f) => {
      const id = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number ?? 0)
      map.set(id, f)
    })
    return { features: feats, featureMap: map }
  }, [activeData])

  const handleHoverChange = useCallback((id: number | null, name: string | null, continent: ContinentId | null) => {
    setHovered(id !== null ? { id, name: name ?? '', continent } : null)
    setHovCont(selectionMode === 'continent' ? continent : null)
  }, [selectionMode])

  const handleContinentClick = useCallback((continent: ContinentId, ids: number[], feats: GeoJSON.Feature[]) => {
    setSelCont(continent)
    onContinentSelect?.(continent, ids, feats)
  }, [onContinentSelect])

  const handleCountryClick = useCallback((id: number, name: string, feat: GeoJSON.Feature) => {
    onMultiCountryToggle?.(id, name, feat)
    onCountrySelect?.(id, name, feat)
  }, [onMultiCountryToggle, onCountrySelect])

  const tooltipText = selectionMode === 'continent' && hoveredContinent
    ? CONTINENT_INFO[hoveredContinent].label
    : hovered?.name ?? null

  const initCamPos = useMemo(() => {
    if (!focusLatLon) return [0, 0, 2.8] as const
    return latLonToVec3(focusLatLon[0], focusLatLon[1], 2.8).toArray() as [number, number, number]
  }, [focusLatLon])

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: initCamPos, fov: 45, near: 0.02, far: 1000 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        style={{ background: 'transparent' }}
      >
        {/* Sun-like key light from upper-right */}
        <directionalLight position={[4, 2, 4]}   intensity={3.2}  color="#fff5e0" />
        {/* Cool fill light from the dark side */}
        <directionalLight position={[-3, -1, -4]} intensity={0.5}  color="#1a3a6e" />
        {/* Very subtle ambient to lift the darkest shadows slightly */}
        <ambientLight intensity={0.08} />

        {/* Deep star field */}
        <Stars radius={120} depth={80} count={8000} factor={4} saturation={0.3} fade speed={0.3} />

        <Suspense fallback={null}>
          <EarthMesh />
        </Suspense>

        {features.length > 0 && (
          <>
            <CountryBorders
              features={features}
              featureMap={featureMap}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              interactable={interactive}
              onHoverChange={handleHoverChange}
              onContinentClick={handleContinentClick}
              onCountryClick={handleCountryClick}
            />
            <ContinentLabels
              hoveredContinent={hoveredContinent}
              selectedContinent={selectedContinent}
              selectionMode={selectionMode}
            />
          </>
        )}

        <OrbitControls
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          minDistance={1.05}
          maxDistance={5.0}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          dampingFactor={0.06}
          enableDamping
          zoomSpeed={0.7}
        />

        {onZoomChange && <ZoomTracker onZoomChange={onZoomChange} />}

        {/* Zone overlays: coloured Voronoi cells projected onto the sphere */}
        {territories.length > 0 && (
          <ZoneOverlays territories={territories} countryFeatures={countryFeatures} />
        )}

        {markers.length > 0 && <CityMarkers markers={markers} />}
      </Canvas>

      {/* Hover tooltip */}
      {tooltipText && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div
            className="px-5 py-2.5 rounded-full border border-crusader-gold/30 backdrop-blur-md"
            style={{ background: 'rgba(8,6,4,0.75)' }}
          >
            <p className="text-sm font-cinzel text-crusader-gold tracking-widest whitespace-nowrap">
              {tooltipText}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
