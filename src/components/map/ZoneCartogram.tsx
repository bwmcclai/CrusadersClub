'use client'
import { useState, useMemo } from 'react'
import type { Territory } from '@/types'

const CARTOGRAM_PALETTE = [
  '#C94040', '#3A7EC5', '#2E8B57', '#D4A843', '#7B4C96',
  '#2E8B8B', '#C96C30', '#8C3E8C', '#4C8C4C', '#3E6B8C',
  '#8C5A3E', '#5A3E8C', '#3E8C6B', '#8C3E5A', '#6B8C3E',
  '#8C7A3E', '#3E5A8C', '#8C4C3E', '#5A8C3E', '#8C3E6B',
]

interface ZoneCartogramProps {
  territories: Territory[]
  className?:  string
  /** Show city name labels (default true) */
  labels?:     boolean
}

export default function ZoneCartogram({ territories, className = 'w-full h-full', labels = true }: ZoneCartogramProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const viewBox = useMemo(() => {
    if (!territories.length) return '0 0 800 400'
    const allX = territories.flatMap((t) => t.polygon?.map(([x]) => x) ?? [])
    const allY = territories.flatMap((t) => t.polygon?.map(([, y]) => y) ?? [])
    if (!allX.length) return '0 0 800 400'
    const pad  = 12
    const minX = Math.min(...allX) - pad
    const minY = Math.min(...allY) - pad
    const w    = Math.max(...allX) - minX + pad
    const h    = Math.max(...allY) - minY + pad
    return `${minX} ${minY} ${w} ${h}`
  }, [territories])

  if (!territories.length) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <p className="text-crusader-gold/30 font-cinzel text-sm">No zones</p>
      </div>
    )
  }

  return (
    <svg
      viewBox={viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{ background: '#080810' }}
    >
      <defs>
        <pattern id="zc-water-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(100,140,200,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x="-9999" y="-9999" width="99999" height="99999" fill="url(#zc-water-grid)" />

      {territories.map((t, i) => {
        if (!t.polygon || t.polygon.length < 3) return null
        const isHovered = t.id === hoveredId
        const color = CARTOGRAM_PALETTE[i % CARTOGRAM_PALETTE.length]
        const d = t.polygon
          .map(([x, y], j) => `${j === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
          .join(' ') + ' Z'
        const [cx, cy] = t.seed

        return (
          <g
            key={t.id}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <path
              d={d}
              fill={color}
              fillOpacity={isHovered ? 0.95 : 0.78}
              stroke={isHovered ? '#F0D88A' : '#C9A84C'}
              strokeWidth={isHovered ? 1.2 : 0.5}
              strokeLinejoin="round"
            />
            {isHovered && (
              <path
                d={d}
                fill="none"
                stroke="#F0D88A"
                strokeWidth={3}
                strokeLinejoin="round"
                opacity={0.25}
                style={{ filter: 'blur(2px)' }}
              />
            )}
            {labels && (
              <text
                x={cx} y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={5}
                fontFamily="Cinzel, serif"
                fill="rgba(255,255,255,0.80)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {t.name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
