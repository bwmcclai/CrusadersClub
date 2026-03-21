'use client'
import {
  useRef, useEffect, useState, useMemo, useCallback,
  type MutableRefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line } from '@react-three/drei'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'

// ─── Utility ──────────────────────────────────────────────────────────────────

function latLonToVec3(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
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
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
    );
  }

  float fbm(vec3 p) {
    return noise(p * 2.0) * 0.50
         + noise(p * 4.0) * 0.25
         + noise(p * 8.0) * 0.125
         + noise(p * 16.0)* 0.0625;
  }

  void main() {
    vec3 deepOcean   = vec3(0.02, 0.06, 0.20);
    vec3 shallowSea  = vec3(0.04, 0.14, 0.38);
    vec3 coastLine   = vec3(0.18, 0.30, 0.14);
    vec3 land        = vec3(0.10, 0.22, 0.09);
    vec3 highland    = vec3(0.22, 0.18, 0.10);
    vec3 ice         = vec3(0.85, 0.92, 1.00);

    float n = fbm(vPosition * 1.6);

    vec3 color;
    if (n < 0.42) {
      color = mix(deepOcean, shallowSea, smoothstep(0.35, 0.42, n));
    } else if (n < 0.46) {
      color = mix(shallowSea, coastLine, smoothstep(0.42, 0.46, n));
    } else if (n < 0.60) {
      color = mix(land, highland, smoothstep(0.46, 0.60, n));
    } else {
      color = highland;
    }

    // Polar ice
    float lat = abs(vNormal.y);
    color = mix(color, ice, smoothstep(0.78, 0.92, lat));

    // Diffuse lighting
    vec3 lightDir = normalize(vec3(2.0, 1.0, 1.5));
    float diff = clamp(dot(vNormal, lightDir), 0.0, 1.0);
    float amb  = 0.18;
    color *= amb + diff * 0.85;

    // Specular on water
    if (n < 0.42) {
      vec3 viewDir = normalize(-vPosition);
      vec3 h = normalize(lightDir + viewDir);
      float spec = pow(max(dot(vNormal, h), 0.0), 64.0);
      color += vec3(0.3, 0.5, 0.8) * spec * 0.4;
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
    vec3 color = vec3(0.15, 0.55, 1.0);
    gl_FragColor = vec4(color * intensity, intensity * 0.85);
  }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function EarthMesh({ rotating }: { rotating: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   earthVertexShader,
    fragmentShader: earthFragmentShader,
  }), [])

  useFrame((_, dt) => {
    if (rotating && meshRef.current) meshRef.current.rotation.y += dt * 0.08
  })

  return (
    <mesh ref={meshRef} material={material}>
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

interface CountryBordersProps {
  topology:          Topology
  hoveredId?:        number | null
  selectedId?:       number | null
  onHover?:          (id: number | null, name: string | null) => void
  onSelect?:         (id: number, name: string, feature: GeoJSON.Feature) => void
  interactable:      boolean
}

function CountryBorders({
  topology, hoveredId, selectedId, onHover, onSelect, interactable,
}: CountryBordersProps) {
  const { camera, raycaster, gl } = useThree()
  const meshRef = useRef<THREE.Mesh>(null!)

  const { features, borderSegments } = useMemo(() => {
    const countries = feature(
      topology,
      topology.objects.countries as GeometryCollection,
    )
    const allFeatures = countries.features

    // Build line segments for all borders
    const segments: { points: THREE.Vector3[]; id: number; color: string }[] = []
    allFeatures.forEach((feat, i) => {
      const geo = feat.geometry
      if (!geo) return
      const rings: number[][][] =
        geo.type === 'Polygon'
          ? geo.coordinates
          : geo.type === 'MultiPolygon'
          ? geo.coordinates.flat()
          : []

      rings.forEach((ring) => {
        const points = ringToPoints(ring)
        const id = typeof (feat.id) === 'string' ? parseInt(feat.id) : (feat.id as number ?? i)
        segments.push({ points, id, color: '#4AAFD4' })
      })
    })

    return { features: allFeatures, borderSegments: segments }
  }, [topology])

  // Invisible pick-sphere for raycasting
  const pickMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  }), [])

  const handlePointerMove = useCallback((e: THREE.Event) => {
    if (!interactable || !onHover) return
    const ev = e as unknown as React.PointerEvent
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width)  * 2 - 1
    const y = -((ev.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const hits = raycaster.intersectObject(meshRef.current)
    if (hits.length > 0) {
      const point = hits[0].point.normalize()
      const lat = Math.asin(point.y) * (180 / Math.PI)
      const lon = Math.atan2(-point.z, -point.x) * (180 / Math.PI) + 180 - 180
      // Find which country contains this lat/lon — simplified: find nearest border
      onHover(null, null)
    } else {
      onHover(null, null)
    }
  }, [interactable, onHover, camera, raycaster, gl])

  return (
    <>
      {/* Pick mesh */}
      <mesh ref={meshRef} material={pickMaterial}>
        <sphereGeometry args={[1.001, 32, 32]} />
      </mesh>

      {/* Border lines */}
      {borderSegments.map((seg, i) => {
        const isHovered  = seg.id === hoveredId
        const isSelected = seg.id === selectedId
        const color =
          isSelected ? '#C9A84C' :
          isHovered  ? '#E8D090' :
          '#4AAFD466'
        const lw = isSelected ? 1.8 : isHovered ? 1.2 : 0.4

        return (
          <Line
            key={i}
            points={seg.points}
            color={color}
            lineWidth={lw}
          />
        )
      })}
    </>
  )
}

// ─── Public Component ─────────────────────────────────────────────────────────

interface EarthGlobeProps {
  interactive?:      boolean
  autoRotate?:       boolean
  onCountrySelect?:  (id: number, name: string, feature: GeoJSON.Feature) => void
  className?:        string
}

interface WorldAtlas {
  topology: Topology
}

export default function EarthGlobe({
  interactive = true,
  autoRotate  = true,
  onCountrySelect,
  className   = 'w-full h-full',
}: EarthGlobeProps) {
  const [worldData, setWorldData] = useState<Topology | null>(null)
  const [hovered, setHovered]     = useState<{ id: number; name: string } | null>(null)
  const [selected, setSelected]   = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then((r) => r.json())
      .then((data: Topology) => setWorldData(data))
      .catch(console.error)
  }, [])

  const handleHover = useCallback((id: number | null, name: string | null) => {
    setHovered(id !== null ? { id, name: name ?? '' } : null)
  }, [])

  const handleSelect = useCallback((id: number, name: string, feat: GeoJSON.Feature) => {
    setSelected({ id, name })
    onCountrySelect?.(id, name, feat)
  }, [onCountrySelect])

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 3, 5]} intensity={2} color="#fff8e7" />
        <pointLight position={[-5, -3, -5]} intensity={0.3} color="#1A3A5E" />

        {/* Stars */}
        <Stars
          radius={100} depth={60} count={6000}
          factor={4} saturation={0} fade speed={0.5}
        />

        {/* Earth */}
        <EarthMesh rotating={autoRotate && !interactive} />

        {/* Atmosphere */}
        <Atmosphere />

        {/* Country borders */}
        {worldData && (
          <CountryBorders
            topology={worldData}
            hoveredId={hovered?.id}
            selectedId={selected?.id}
            onHover={handleHover}
            onSelect={handleSelect}
            interactable={interactive}
          />
        )}

        {/* Controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          minDistance={1.3}
          maxDistance={5}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>

      {/* Hovered label */}
      {hovered && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none glass px-4 py-2 rounded-full text-sm font-cinzel text-crusader-gold tracking-widest">
          {hovered.name}
        </div>
      )}
    </div>
  )
}
