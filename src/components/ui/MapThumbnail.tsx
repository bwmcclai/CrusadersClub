'use client'
import { useRef, useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { Territory } from '@/types'

// Matches EarthGlobe zone palette
const ZONE_PALETTE = [
  '#C94040', '#3A7EC5', '#2E8B57', '#D4A843', '#7B4C96',
  '#2E8B8B', '#C96C30', '#8C3E8C', '#4C8C4C', '#3E6B8C',
  '#8C5A3E', '#5A3E8C', '#3E8C6B', '#8C3E5A', '#6B8C3E',
  '#8C7A3E', '#3E5A8C', '#8C4C3E', '#5A8C3E', '#8C3E6B',
]

// ── Topology cache (module-level singleton) ───────────────────────────────────
let _topo: any = null
let _topoPromise: Promise<any> | null = null

function loadTopo(): Promise<any> {
  if (_topo) return Promise.resolve(_topo)
  if (!_topoPromise) {
    _topoPromise = fetch('/countries-50m.json')
      .then((r) => r.json())
      .then((d) => { _topo = d; return d })
      .catch(() => null)
  }
  return _topoPromise
}

// ── Mercator projection (1200×600 space, matching EarthGlobe) ─────────────────
const MW = 1200, MH = 600

function lonToMX(lon: number) {
  return (lon + 180) * MW / 360
}
function latToMY(lat: number) {
  const r = lat * Math.PI / 180
  return MH / 2 - Math.log(Math.tan(Math.PI / 4 + r / 2)) * MW / (2 * Math.PI)
}

interface RegionBounds {
  minLat: number; maxLat: number; minLon: number; maxLon: number
}

interface Props {
  territories: Territory[]
  selectedIds?: number[]
  regionBounds?: RegionBounds
  className?: string
}

export default function MapThumbnail({ territories, selectedIds = [], regionBounds, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [topo, setTopo] = useState<any>(_topo)

  useEffect(() => {
    if (!_topo) {
      loadTopo().then(setTopo)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // ── Dark background ───────────────────────────────────────────────────────
    ctx.fillStyle = '#070a10'
    ctx.fillRect(0, 0, W, H)

    if (!topo) return  // topology still loading — just show the dark bg for now

    // ── Determine viewport in Mercator space ──────────────────────────────────
    let vx0: number, vy0: number, vx1: number, vy1: number

    if (regionBounds) {
      vx0 = lonToMX(regionBounds.minLon)
      vx1 = lonToMX(regionBounds.maxLon)
      vy0 = latToMY(regionBounds.maxLat) // maxLat → smaller y (top)
      vy1 = latToMY(regionBounds.minLat) // minLat → larger y (bottom)
    } else if (territories.length > 0) {
      // Fall back: derive from territory polygon bounding box
      vx0 = Infinity; vx1 = -Infinity; vy0 = Infinity; vy1 = -Infinity
      for (const t of territories) {
        for (const [x, y] of (t.polygon ?? [])) {
          if (x < vx0) vx0 = x; if (x > vx1) vx1 = x
          if (y < vy0) vy0 = y; if (y > vy1) vy1 = y
        }
      }
    } else {
      vx0 = 0; vy0 = 0; vx1 = MW; vy1 = MH
    }

    // Padding so the region isn't flush against the edge
    const padX = (vx1 - vx0) * 0.12
    const padY = (vy1 - vy0) * 0.12
    vx0 -= padX; vx1 += padX; vy0 -= padY; vy1 += padY

    // Keep aspect ratio — letterbox inside canvas
    const srcW = vx1 - vx0
    const srcH = vy1 - vy0
    const scale = Math.min(W / srcW, H / srcH)
    const drawW = srcW * scale
    const drawH = srcH * scale
    const offX = (W - drawW) / 2
    const offY = (H - drawH) / 2

    const toCanvasX = (mx: number) => (mx - vx0) * scale + offX
    const toCanvasY = (my: number) => (my - vy0) * scale + offY

    // ── Draw country outlines ─────────────────────────────────────────────────
    const selectedSet = new Set(selectedIds.map(Number))
    const countries = feature(topo, topo.objects.countries) as any

    const drawRings = (rings: number[][][]) => {
      ctx.beginPath()
      for (const ring of rings) {
        let first = true
        let prevLon = 0
        for (const [lon, lat] of ring) {
          // Skip segment if it crosses the antimeridian (large lon jump)
          if (!first && Math.abs(lon - prevLon) > 90) { first = true }
          const cx = toCanvasX(lonToMX(lon))
          const cy = toCanvasY(latToMY(lat))
          if (first) { ctx.moveTo(cx, cy); first = false }
          else ctx.lineTo(cx, cy)
          prevLon = lon
        }
        ctx.closePath()
      }
    }

    for (const f of countries.features) {
      const geom = f.geometry
      if (!geom) continue
      const rings: number[][][] =
        geom.type === 'Polygon' ? geom.coordinates :
        geom.type === 'MultiPolygon' ? geom.coordinates.flat(1) : []

      const isSelected = selectedSet.has(Number(f.id))

      drawRings(rings)

      if (isSelected) {
        ctx.fillStyle = '#1e2d1a'
        ctx.fill()
        ctx.strokeStyle = '#c9a84c55'
      } else {
        ctx.fillStyle = '#111520'
        ctx.fill()
        ctx.strokeStyle = '#2a3040'
      }
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // ── Territory polygons overlaid (game zones) ──────────────────────────────
    if (territories.length > 0) {
      for (let i = 0; i < territories.length; i++) {
        const t = territories[i]
        if (!t.polygon || t.polygon.length < 3) continue
        const color = t.color ?? ZONE_PALETTE[i % ZONE_PALETTE.length]

        ctx.beginPath()
        for (let j = 0; j < t.polygon.length; j++) {
          const [x, y] = t.polygon[j]
          const cx = toCanvasX(x)
          const cy = toCanvasY(y)
          if (j === 0) ctx.moveTo(cx, cy)
          else ctx.lineTo(cx, cy)
        }
        ctx.closePath()
        ctx.fillStyle = color + 'bb'
        ctx.fill()
        ctx.strokeStyle = '#07090e99'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // ── Vignette ──────────────────────────────────────────────────────────────
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, W, H)

  }, [topo, territories, selectedIds, regionBounds])

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={180}
      className={className}
    />
  )
}
