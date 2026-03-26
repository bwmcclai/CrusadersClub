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
  // Apply a subtle color tint to make the earth feel richer, not washed-out parchment
  return (
    <mesh>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.85}
        metalness={0.05}
        color="#c8d4e8"   // very slight blue-cool tint to complement atmosphere
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
  return (
    <>
      {markers.map((m) => {
        const pos = latLonToVec3(m.lat, m.lon, 1.028)
        return (
          <Html key={m.id} position={pos} center occlude distanceFactor={3.5}>
            <div
              className="pointer-events-none flex flex-col items-center"
              style={{ gap: '4px' }}
            >
              {/* Pulsing ring + dot */}
              <div style={{ position: 'relative', width: 14, height: 14 }}>
                <div style={{
                  position:    'absolute',
                  inset:       0,
                  borderRadius: '50%',
                  border:      '1.5px solid rgba(77,217,172,0.5)',
                  animation:   'ping 2s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <div style={{
                  position:     'absolute',
                  inset:        '2px',
                  borderRadius: '50%',
                  border:       '2px solid #4DD9AC',
                  background:   'rgba(14,60,50,0.9)',
                  boxShadow:    '0 0 8px rgba(77,217,172,0.55)',
                }} />
              </div>
              {/* Label */}
              <span style={{
                fontSize:     '8.5px',
                fontFamily:   '"Cinzel", serif',
                color:        'rgba(255,255,255,0.9)',
                textShadow:   '0 1px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)',
                whiteSpace:   'nowrap',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {m.label}
              </span>
            </div>
          </Html>
        )
      })}
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
  focusLatLon,
  className      = 'w-full h-full',
}: EarthGlobeProps) {
  const [worldData, setWorldData]       = useState<Topology | null>(null)
  const [hovered, setHovered]           = useState<{ id: number; name: string; continent: ContinentId | null } | null>(null)
  const [hoveredContinent, setHovCont]  = useState<ContinentId | null>(null)
  const [selectedContinent, setSelCont] = useState<ContinentId | null>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then((r) => r.json())
      .then((data: Topology) => setWorldData(data))
      .catch(console.error)
  }, [])

  const { features, featureMap } = useMemo(() => {
    if (!worldData) return { features: [], featureMap: new Map() }
    const countries = feature(worldData, worldData.objects.countries as GeometryCollection)
    const feats = countries.features
    const map = new Map<number, GeoJSON.Feature>()
    feats.forEach((f) => {
      const id = typeof f.id === 'string' ? parseInt(f.id) : (f.id as number ?? 0)
      map.set(id, f)
    })
    return { features: feats, featureMap: map }
  }, [worldData])

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
        camera={{ position: initCamPos, fov: 45, near: 0.1, far: 1000 }}
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
          minDistance={1.3}
          maxDistance={5.0}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          dampingFactor={0.06}
          enableDamping
          zoomSpeed={0.7}
        />

        {onZoomChange && <ZoomTracker onZoomChange={onZoomChange} />}

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
