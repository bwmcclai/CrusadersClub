'use client'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Territory, TerritoryState, GamePlayer } from '@/types'

// ─── Colour helpers ──────────────────────────────────────────────────────────

const TERRITORY_PALETTE = [
  '#8B3A3A', '#3A5A4A', '#8A6E2F', '#3A4A6A',
  '#6B2A2A', '#634b22', '#2F4F4F', '#4A3A4A',
]

function getTerritoryFill(
  territory: Territory,
  state?:    TerritoryState,
  players?:  GamePlayer[],
  index?:    number,
): string {
  if (state?.owner_id && players) {
    const player = players.find((p) => p.player_id === state.owner_id)
    if (player) return player.color + 'CC'
  }
  return TERRITORY_PALETTE[(index ?? 0) % TERRITORY_PALETTE.length]
}

// ─── Single territory ────────────────────────────────────────────────────────

interface TerritoryPathProps {
  territory:      Territory
  fill:           string
  isSelected:     boolean
  isAttackable:   boolean
  armies?:        number
  onClick:        () => void
  onHover:        (id: string | null) => void
  isHovered:      boolean
}

function TerritoryPath({
  territory, fill, isSelected, isAttackable, armies,
  onClick, onHover, isHovered,
}: TerritoryPathProps) {
  const polygon = territory.polygon
  if (!polygon || polygon.length < 3) return null

  const d = polygon
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ') + ' Z'

  const strokeColor = isSelected   ? '#C9A84C'
    : isAttackable                  ? '#C0392B'
    : isHovered                     ? '#E8D090'
    : 'rgba(43, 29, 22, 0.5)'
  const strokeW = isSelected || isAttackable ? 2 : isHovered ? 1.5 : 0.8

  const [cx, cy] = territory.seed

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => onHover(territory.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      <path
        d={d}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeLinejoin="round"
        opacity={isHovered ? 0.95 : 0.85}
        className="transition-all duration-150"
      />
      {/* Glow on selected */}
      {(isSelected || isAttackable) && (
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={4}
          strokeLinejoin="round"
          opacity={0.3}
          style={{ filter: 'blur(3px)' }}
        />
      )}
      {/* Army count badge */}
      {armies !== undefined && (
        <>
          <circle cx={cx} cy={cy} r={10} fill="rgba(0,0,0,0.75)" stroke={strokeColor} strokeWidth={1} />
          <text
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fontWeight="bold"
            fill="white"
          >
            {armies}
          </text>
        </>
      )}
      {/* Territory name (editor mode) */}
      {armies === undefined && (
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          fontFamily="Cinzel, serif"
          fill="rgba(255,255,255,0.5)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {territory.name.replace('Territory ', 'T')}
        </text>
      )}
    </g>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface TerritoryMapProps {
  territories:     Territory[]
  territoryStates?: TerritoryState[]
  players?:        GamePlayer[]
  selectedId?:     string | null
  attackableIds?:  string[]
  onTerritoryClick?: (t: Territory) => void
  viewBox?:        string
  className?:      string
  editorMode?:     boolean
}

export default function TerritoryMap({
  territories,
  territoryStates,
  players,
  selectedId,
  attackableIds = [],
  onTerritoryClick,
  viewBox,
  className,
  editorMode = false,
}: TerritoryMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const computedViewBox = useMemo(() => {
    if (viewBox) return viewBox
    if (!territories.length) return '0 0 800 600'
    const allX = territories.flatMap((t) => t.polygon.map(([x]) => x))
    const allY = territories.flatMap((t) => t.polygon.map(([, y]) => y))
    const minX = Math.min(...allX) - 10
    const minY = Math.min(...allY) - 10
    const maxX = Math.max(...allX) + 10
    const maxY = Math.max(...allY) + 10
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
  }, [territories, viewBox])

  return (
    <svg
      viewBox={computedViewBox}
      className={cn('w-full h-full', className)}
      style={{ background: 'transparent' }}
    >
      <defs>
        <filter id="glow-gold">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-red">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {territories.map((t, i) => {
        const state      = territoryStates?.find((s) => s.territory_id === t.id)
        const fill       = getTerritoryFill(t, state, players, i)
        const isSelected = t.id === selectedId
        const isAttackable = attackableIds.includes(t.id)
        const isHovered  = t.id === hoveredId

        return (
          <TerritoryPath
            key={t.id}
            territory={t}
            fill={fill}
            isSelected={isSelected}
            isAttackable={isAttackable}
            armies={state?.armies}
            onClick={() => onTerritoryClick?.(t)}
            onHover={setHoveredId}
            isHovered={isHovered}
          />
        )
      })}
    </svg>
  )
}
