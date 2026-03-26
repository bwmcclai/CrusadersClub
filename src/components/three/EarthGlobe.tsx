'use client'
import {
  useRef, useEffect, useState, useMemo, useCallback, Suspense
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { feature } from 'topojson-client'
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

// ─── Zone Overlays ────────────────────────────────────────────────────────────
// Paints Voronoi territory polygons onto a 2048×1024 canvas in equirectangular
// space, then wraps that canvas as a transparent texture on a sphere sitting
// just above the globe surface.  Three.js SphereGeometry uses equirectangular
// UV (u = (lon+180)/360, v = (lat+90)/180) so the canvas pixels align exactly
// with the globe.  Each territory gets a unique colour (NCAA-map style).
// No triangulation needed — Canvas 2D fills concave polygons perfectly.

function ZoneOverlays({
  territories,
  countryFeatures = [],
}: {
  territories:     Territory[]
  countryFeatures: GeoJSON.Feature[]
}) {
  const texture = useMemo(() => {
    if (territories.length === 0) return null

    // 4096×2048 → 4× more texels than before, eliminates most aliasing
    const W = 4096, H = 2048
    const canvas = document.createElement('canvas')
    canvas.width  = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // ── Helper: trace a territory polygon as a canvas path ────────────────────
    const tracePath = (territory: Territory) => {
      ctx.beginPath()
      territory.polygon.forEach(([mx, my], j) => {
        const [lon, lat] = invMercator(mx, my)
        const px = (lon + 180) / 360 * W
        const py = (90  - lat) / 180 * H
        if (j === 0) ctx.moveTo(px, py)
        else         ctx.lineTo(px, py)
      })
      ctx.closePath()
    }

    // ── Helper: clip canvas to a set of GeoJSON features ──────────────────────
    const applyClip = (feats: GeoJSON.Feature[]) => {
      ctx.beginPath()
      for (const feat of feats) {
        const geo = feat.geometry
        if (!geo) continue
        const rings: number[][][] =
          geo.type === 'Polygon'      ? geo.coordinates as number[][][] :
          geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][]).flat() :
          []
        for (const ring of rings) {
          ring.forEach(([lon, lat], j) => {
            const px = (lon + 180) / 360 * W
            const py = (90  - lat) / 180 * H
            if (j === 0) ctx.moveTo(px, py)
            else         ctx.lineTo(px, py)
          })
          ctx.closePath()
        }
      }
      ctx.clip('evenodd')
    }

    // ── Build a lookup: bonus-group key → GeoJSON features for that country ───
    // territory.bonus_group is "bonus-<isoNumeric>" from generateZonesFromCities
    const featsByGroup = new Map<string, GeoJSON.Feature[]>()
    for (const feat of countryFeatures) {
      const iso = typeof feat.id === 'string' ? parseInt(feat.id) : (feat.id as number ?? 0)
      const key = `bonus-${iso}`
      if (!featsByGroup.has(key)) featsByGroup.set(key, [])
      featsByGroup.get(key)!.push(feat)
    }

    // ── Group territories by country, preserving global index for palette ─────
    const byCountry = new Map<string, { territory: Territory; gi: number }[]>()
    territories.forEach((t, gi) => {
      const key = t.bonus_group ?? '__all__'
      if (!byCountry.has(key)) byCountry.set(key, [])
      byCountry.get(key)!.push({ territory: t, gi })
    })

    // ── Render each country's zones within its own clipping region ────────────
    for (const [key, entries] of byCountry) {
      const feats = featsByGroup.get(key) ?? (key === '__all__' ? countryFeatures : [])

      ctx.save()
      if (feats.length > 0) applyClip(feats)

      // Pass 1: fills
      entries.forEach(({ territory, gi }) => {
        if (!territory.polygon || territory.polygon.length < 3) return
        tracePath(territory)
        ctx.fillStyle = ZONE_PALETTE[gi % ZONE_PALETTE.length] + 'CC'
        ctx.fill()
      })

      // Pass 2: subtle glow
      ctx.save()
      ctx.filter = 'blur(3px)'
      entries.forEach(({ territory }) => {
        if (!territory.polygon || territory.polygon.length < 3) return
        tracePath(territory)
        ctx.strokeStyle = 'rgba(255, 210, 100, 0.25)'
        ctx.lineWidth   = 7
        ctx.lineJoin    = 'round'
        ctx.stroke()
      })
      ctx.restore()

      // Pass 3: crisp gold border
      entries.forEach(({ territory }) => {
        if (!territory.polygon || territory.polygon.length < 3) return
        tracePath(territory)
        ctx.strokeStyle = 'rgba(210, 165, 55, 0.90)'
        ctx.lineWidth   = 2.5
        ctx.lineJoin    = 'round'
        ctx.stroke()
      })

      ctx.restore()
    }

    const tex = new THREE.CanvasTexture(canvas)
    // Anisotropic filtering eliminates blurring when the sphere is viewed at
    // a shallow angle (the main cause of the "fuzzy" appearance)
    tex.anisotropy  = 16
    tex.needsUpdate = true
    return tex
  }, [territories, countryFeatures])

  useEffect(() => {
    return () => { texture?.dispose() }
  }, [texture])

  if (!texture) return null

  return (
    <mesh>
      {/* Slightly outside the globe (r=1.0) so zones render on top */}
      <sphereGeometry args={[1.002, 256, 256]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
      />
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

      {/* Single label for hovered item */}
      {hoveredIdx !== null && markers[hoveredIdx] && (
        <Html
          position={positions[hoveredIdx]}
          center={false}
          distanceFactor={6}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{ transform: 'translate(-50%, 8px)' }}>
            <div
              className="border border-crusader-gold/25 rounded px-1.5 py-0.5 backdrop-blur-sm"
              style={{ background: 'rgba(5,4,2,0.82)' }}
            >
              <span className="font-cinzel text-[8px] text-crusader-gold/90 whitespace-nowrap tracking-widest uppercase">
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
