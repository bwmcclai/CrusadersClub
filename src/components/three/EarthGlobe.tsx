'use client'
import {
  useRef, useEffect, useState, useMemo, useCallback,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html } from '@react-three/drei'
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

// ─── Globe Shaders ────────────────────────────────────────────────────────────

const earthVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const earthFragmentShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z
    );
  }
  float fbm(vec3 p) {
    return noise(p*2.0)*0.50 + noise(p*4.0)*0.25 + noise(p*8.0)*0.125 + noise(p*16.0)*0.0625;
  }

  void main() {
    vec3 deepOcean  = vec3(0.85, 0.80, 0.65);
    vec3 shallowSea = vec3(0.90, 0.85, 0.70);
    vec3 coastLine  = vec3(0.55, 0.45, 0.27);
    vec3 land       = vec3(0.82, 0.73, 0.56);
    vec3 highland   = vec3(0.73, 0.62, 0.42);
    vec3 ice        = vec3(0.88, 0.80, 0.65);

    float n = fbm(vPosition * 1.6);

    vec3 color;
    if (n < 0.42)      color = mix(deepOcean, shallowSea, smoothstep(0.35, 0.42, n));
    else if (n < 0.46) color = mix(shallowSea, coastLine, smoothstep(0.42, 0.46, n));
    else if (n < 0.60) color = mix(land, highland, smoothstep(0.46, 0.60, n));
    else               color = highland;

    float lat = abs(vNormal.y);
    color = mix(color, ice, smoothstep(0.78, 0.92, lat));

    vec3 lightDir = normalize(vec3(2.0, 1.0, 1.5));
    float diff = clamp(dot(vNormal, lightDir), 0.0, 1.0);
    // Matte paper feel
    color *= 0.4 + diff * 0.6;

    if (n < 0.42) {
      vec3 viewDir = normalize(-vPosition);
      vec3 h = normalize(lightDir + viewDir);
      float spec = pow(max(dot(vNormal, h), 0.0), 32.0);
      color += vec3(0.3, 0.25, 0.15) * spec * 0.1; // Reduced, warmer specular
    }
    gl_FragColor = vec4(color, 1.0);
  }
`

const atmosphereVertexShader = /* glsl */`
  varying float intensity;
  void main() {
    vec3 n   = normalize(normalMatrix * normal);
    vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vec3 eye = normalize(-pos);
    intensity = pow(1.0 - abs(dot(n, eye)), 2.2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = /* glsl */`
  varying float intensity;
  void main() {
    gl_FragColor = vec4(vec3(0.8, 0.6, 0.4) * intensity, intensity * 0.4);
  }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function EarthMesh() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   earthVertexShader,
    fragmentShader: earthFragmentShader,
  }), [])
  return (
    <mesh material={material}>
      <sphereGeometry args={[1, 80, 80]} />
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
    <mesh scale={1.08} material={material}>
      <sphereGeometry args={[1, 32, 32]} />
    </mesh>
  )
}

// ─── Country Borders + Click Detection ────────────────────────────────────────

interface CountryBordersProps {
  features:        GeoJSON.Feature[]
  featureMap:      Map<number, GeoJSON.Feature>
  selectionMode:   'none' | 'continent' | 'multi-country'
  selectedIds:     number[]
  interactable:    boolean
  onHoverChange:   (id: number | null, name: string | null, continent: ContinentId | null) => void
  onContinentClick: (continent: ContinentId, countryIds: number[], features: GeoJSON.Feature[]) => void
  onCountryClick:  (id: number, name: string, feat: GeoJSON.Feature) => void
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
        geo.type === 'Polygon'     ? geo.coordinates as number[][][] :
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

  // Derived: hovered continent (computed externally — we use a ref trick)
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
    if (now - throttleRef.current < 40) return   // ~25fps throttle
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
    // Ignore drag-clicks
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
    } else if (selectionMode === 'multi-country') {
      onCountryClick(id, name, feat)
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
        const isSelected  = selectedIds.includes(seg.id)
        const isHoveredCont = selectionMode === 'continent'
          && hovered?.continent != null
          && seg.continentId === hovered.continent
        const isHovered = hovered?.id === seg.id

        let color: string
        let lw: number

        if (isSelected) {
          color = '#C9A84C'
          lw    = 2.0
        } else if (isHoveredCont || (selectionMode === 'multi-country' && isHovered)) {
          color = '#E8D090'
          lw    = 1.6
        } else {
          color = '#5c403366'
          lw    = 0.5
        }

        return (
          <Line key={i} points={seg.points} color={color} lineWidth={lw} />
        )
      })}
    </>
  )
}

// ─── Continent Labels (drei Html overlay) ─────────────────────────────────────

function ContinentLabels({
  hoveredContinent,
  selectedContinent,
}: {
  hoveredContinent: ContinentId | null
  selectedContinent: ContinentId | null
}) {
  return (
    <>
      {(Object.entries(CONTINENT_INFO) as [ContinentId, typeof CONTINENT_INFO[ContinentId]][]).map(([id, info]) => {
        const pos   = latLonToVec3(info.centroid[1], info.centroid[0], 1.15)
        const isActive = id === hoveredContinent || id === selectedContinent
        return (
          <Html key={id} position={pos} center occlude distanceFactor={3}>
            <div
              className={`pointer-events-none select-none transition-all duration-200 ${
                isActive
                  ? 'opacity-100 scale-110'
                  : 'opacity-40 scale-100'
              }`}
            >
              <span
                style={{ color: isActive ? info.color : '#C9A84C', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                className="font-cinzel font-bold text-xs tracking-wider whitespace-nowrap"
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

// ─── Public Interface ─────────────────────────────────────────────────────────

export interface EarthGlobeProps {
  interactive?:          boolean
  autoRotate?:           boolean
  selectionMode?:        'none' | 'continent' | 'multi-country'
  selectedIds?:          number[]
  onContinentSelect?:    (continent: ContinentId, countryIds: number[], features: GeoJSON.Feature[]) => void
  onMultiCountryToggle?: (id: number, name: string, feature: GeoJSON.Feature) => void
  onCountrySelect?:      (id: number, name: string, feature: GeoJSON.Feature) => void
  className?:            string
}

export default function EarthGlobe({
  interactive    = true,
  autoRotate     = true,
  selectionMode  = 'none',
  selectedIds    = [],
  onContinentSelect,
  onMultiCountryToggle,
  onCountrySelect,
  className      = 'w-full h-full',
}: EarthGlobeProps) {
  const [worldData, setWorldData]         = useState<Topology | null>(null)
  const [hovered, setHovered]             = useState<{ id: number; name: string; continent: ContinentId | null } | null>(null)
  const [hoveredContinent, setHovCont]    = useState<ContinentId | null>(null)
  const [selectedContinent, setSelCont]   = useState<ContinentId | null>(null)

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

  // Tooltip label text
  const tooltipText = selectionMode === 'continent' && hoveredContinent
    ? CONTINENT_INFO[hoveredContinent].label
    : hovered?.name ?? null

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 3, 5]}   intensity={2}   color="#fff8e7" />
        <pointLight position={[-5, -3, -5]} intensity={0.3} color="#1A3A5E" />

        <Stars radius={100} depth={60} count={6000} factor={4} saturation={0} fade speed={0.5} />

        <EarthMesh />
        <Atmosphere />

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
            {selectionMode === 'continent' && (
              <ContinentLabels
                hoveredContinent={hoveredContinent}
                selectedContinent={selectedContinent}
              />
            )}
          </>
        )}

        <OrbitControls
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          minDistance={1.3}
          maxDistance={4.5}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>

      {/* Hover tooltip */}
      {tooltipText && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="glass px-4 py-2 rounded-full border border-crusader-gold/20">
            <p className="text-sm font-cinzel text-crusader-gold tracking-widest whitespace-nowrap">
              {tooltipText}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
