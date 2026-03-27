'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { joinGame } from '@/lib/gameService'
import { useAppStore } from '@/lib/store'
import type { Territory, BonusGroup, GameMode } from '@/types'
import { ArrowLeft, Sword, Shield, Crosshair, ArrowRightLeft, Clock, Crown, Users, Dices } from 'lucide-react'
import Button from '@/components/ui/Button'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type Phase = 'deploy' | 'attack' | 'fortify'

interface GameData {
  id: string
  name: string
  mode: GameMode
  status: 'waiting' | 'active' | 'finished'
  maxPlayers: number
  currentPlayers: number
  turnNumber: number
  currentTurnPlayerId: string | null
  turnDeadline: string | null
  winnerId: string | null
  createdBy: string | null
  mapId: string
  settings: any
}

interface GP {
  id: string
  playerId: string | null
  username: string
  color: string
  isAi: boolean
  turnOrder: number
  cardCount: number
  isEliminated: boolean
}

interface TS {
  territoryId: string
  ownerId: string | null
  armies: number
}

interface GameEvent {
  id: string
  eventType: string
  eventData: any
  turnNumber: number
  createdAt: string
  gamePlayerId: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function computeViewBox(territories: Territory[]) {
  if (!territories.length) return '0 0 800 400'
  const xs = territories.flatMap(t => t.polygon?.map(([x]) => x) ?? [])
  const ys = territories.flatMap(t => t.polygon?.map(([, y]) => y) ?? [])
  if (!xs.length) return '0 0 800 400'
  const pad = 15
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
  return `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`
}

/** BFS: are two territories connected through owned territory? */
function areConnected(
  from: string, to: string,
  territories: Territory[],
  ownerId: string,
  tsMap: Map<string, TS>,
): boolean {
  const adj = new Map(territories.map(t => [t.id, t.adjacent_ids ?? []]))
  const visited = new Set<string>([from])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === to) return true
    for (const n of adj.get(cur) ?? []) {
      if (!visited.has(n) && tsMap.get(n)?.ownerId === ownerId) {
        visited.add(n)
        queue.push(n)
      }
    }
  }
  return false
}

function calcDeployArmies(
  gamePlayerId: string,
  territories: Territory[],
  bonusGroups: BonusGroup[],
  tsMap: Map<string, TS>,
): number {
  let owned = 0
  tsMap.forEach(ts => { if (ts.ownerId === gamePlayerId) owned++ })
  let bonus = 0
  for (const bg of bonusGroups) {
    if (bg.territory_ids.every(tid => tsMap.get(tid)?.ownerId === gamePlayerId)) {
      bonus += bg.bonus_armies
    }
  }
  return Math.max(3, Math.floor(owned / 3)) + bonus
}

// ═══════════════════════════════════════════════════════════════════════════════
// Game Map SVG
// ═══════════════════════════════════════════════════════════════════════════════

function GameMap({
  territories, tsMap, playerMap, phase,
  selectedId, attackFrom, attackTo, fortifyFrom, fortifyTo,
  myGamePlayerId, isMyTurn,
  onClick,
}: {
  territories: Territory[]
  tsMap: Map<string, TS>
  playerMap: Map<string, GP>
  phase: Phase
  selectedId: string | null
  attackFrom: string | null
  attackTo: string | null
  fortifyFrom: string | null
  fortifyTo: string | null
  myGamePlayerId: string | null
  isMyTurn: boolean
  onClick: (id: string) => void
}) {
  const viewBox = useMemo(() => computeViewBox(territories), [territories])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Build adjacency set for highlights
  const attackFromAdj = useMemo(() => {
    if (!attackFrom) return new Set<string>()
    const t = territories.find(t => t.id === attackFrom)
    return new Set(t?.adjacent_ids ?? [])
  }, [attackFrom, territories])

  return (
    <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet" style={{ background: '#060810' }}>
      <defs>
        <pattern id="gm-water" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(100,140,200,0.04)" strokeWidth="0.4" />
        </pattern>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect x="-9999" y="-9999" width="99999" height="99999" fill="url(#gm-water)" />

      {territories.map(t => {
        if (!t.polygon || t.polygon.length < 3) return null
        const ts = tsMap.get(t.id)
        const owner = ts?.ownerId ? playerMap.get(ts.ownerId) : null
        const color = owner?.color ?? '#333'
        const armies = ts?.armies ?? 0
        const [cx, cy] = t.seed
        const d = t.polygon.map(([x, y], j) => `${j === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z'

        const isHovered = hoveredId === t.id
        const isSelected = selectedId === t.id
        const isAttackFrom = attackFrom === t.id
        const isAttackTo = attackTo === t.id
        const isAttackTarget = attackFrom && !attackTo && attackFromAdj.has(t.id) && ts?.ownerId !== tsMap.get(attackFrom)?.ownerId
        const isFortifyFrom = fortifyFrom === t.id
        const isFortifyTo = fortifyTo === t.id
        const isMine = ts?.ownerId === myGamePlayerId

        let strokeColor = 'rgba(0,0,0,0.4)'
        let strokeWidth = 0.5
        let opacity = 0.75
        if (isAttackFrom) { strokeColor = '#FFDD00'; strokeWidth = 2; opacity = 1 }
        else if (isAttackTo) { strokeColor = '#FF4444'; strokeWidth = 2; opacity = 1 }
        else if (isAttackTarget) { strokeColor = '#FF6666'; strokeWidth = 1.2; opacity = 0.9 }
        else if (isFortifyFrom) { strokeColor = '#00FF88'; strokeWidth = 2; opacity = 1 }
        else if (isFortifyTo) { strokeColor = '#00AAFF'; strokeWidth = 2; opacity = 1 }
        else if (isSelected) { strokeColor = '#FFFFFF'; strokeWidth = 2; opacity = 1 }
        else if (isHovered && isMyTurn && isMine) { strokeColor = '#F0D88A'; strokeWidth = 1.2; opacity = 0.9 }
        else if (isHovered) { opacity = 0.85 }

        return (
          <g key={t.id}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onClick(t.id)}
            style={{ cursor: isMyTurn ? 'pointer' : 'default' }}
          >
            <path d={d} fill={color} fillOpacity={opacity} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
            {/* Army count badge */}
            <circle cx={cx} cy={cy} r={5.5} fill="rgba(0,0,0,0.7)" stroke={color} strokeWidth={0.6} />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fontSize={4.5} fontWeight="bold" fontFamily="Cinzel, serif"
              fill="#fff" style={{ pointerEvents: 'none' }}>
              {armies}
            </text>
            {/* Territory name on hover */}
            {isHovered && (
              <text x={cx} y={cy - 9} textAnchor="middle" dominantBaseline="central"
                fontSize={3.5} fontFamily="Cinzel, serif" fill="rgba(255,255,255,0.9)"
                style={{ pointerEvents: 'none' }}>
                {t.name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function GamePage() {
  const { id: rawId } = useParams()
  const gameId = rawId as string
  const router = useRouter()
  const player = useAppStore(s => s.player)
  const sb = getSupabaseClient()

  // ── Core state ──────────────────────────────────────────────────────────────
  const [game, setGame] = useState<GameData | null>(null)
  const [players, setPlayers] = useState<GP[]>([])
  const [mapTerritories, setMapTerritories] = useState<Territory[]>([])
  const [bonusGroups, setBonusGroups] = useState<BonusGroup[]>([])
  const [tsList, setTsList] = useState<TS[]>([])
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Turn / phase state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('deploy')
  const [deployLeft, setDeployLeft] = useState(0)
  const [attackFrom, setAttackFrom] = useState<string | null>(null)
  const [attackTo, setAttackTo] = useState<string | null>(null)
  const [attackDiceCount, setAttackDiceCount] = useState(3)
  const [fortifyFrom, setFortifyFrom] = useState<string | null>(null)
  const [fortifyTo, setFortifyTo] = useState<string | null>(null)
  const [fortifyAmount, setFortifyAmount] = useState(1)
  const [lastDice, setLastDice] = useState<{ attack_dice: number[]; defend_dice: number[]; attacker_losses: number; defender_losses: number } | null>(null)
  const [conqueredThisTurn, setConqueredThisTurn] = useState(false)
  const [actionLock, setActionLock] = useState(false)
  const botRunning = useRef(false)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const tsMap = useMemo(() => {
    const m = new Map<string, TS>()
    tsList.forEach(ts => m.set(ts.territoryId, ts))
    return m
  }, [tsList])

  const playerMap = useMemo(() => {
    const m = new Map<string, GP>()
    players.forEach(p => m.set(p.id, p))
    return m
  }, [players])

  const myGP = players.find(p => p.playerId === player?.id) ?? null
  const isMyTurn = !!(game?.currentTurnPlayerId && myGP && game.currentTurnPlayerId === myGP.id)
  const currentTP = game?.currentTurnPlayerId ? playerMap.get(game.currentTurnPlayerId) : null
  const isCreator = game?.createdBy === player?.id

  // ── Fetch game data ─────────────────────────────────────────────────────────
  async function fetchAll() {
    try {
      setLoading(true)

      const { data: g, error: gErr } = await sb.from('games')
        .select('id, name, mode, status, max_players, current_players, turn_number, current_turn_player_id, turn_deadline, winner_id, created_by, map_id, settings')
        .eq('id', gameId).single()
      if (gErr || !g) throw gErr ?? new Error('Game not found')

      const gd: GameData = {
        id: g.id, name: g.name, mode: g.mode, status: g.status,
        maxPlayers: g.max_players, currentPlayers: g.current_players,
        turnNumber: g.turn_number, currentTurnPlayerId: g.current_turn_player_id,
        turnDeadline: g.turn_deadline, winnerId: g.winner_id,
        createdBy: g.created_by, mapId: g.map_id, settings: g.settings,
      }
      setGame(gd)

      // Fetch map
      const { data: mapData } = await sb.from('battle_maps')
        .select('territories, bonus_groups').eq('id', g.map_id).single()
      if (mapData) {
        setMapTerritories(mapData.territories as Territory[])
        setBonusGroups((mapData.bonus_groups ?? []) as BonusGroup[])
      }

      // Fetch players
      await fetchPlayers()

      // Fetch territory states
      if (gd.status === 'active' || gd.status === 'finished') {
        const { data: tsData } = await sb.from('territory_states')
          .select('territory_id, owner_player_id, armies')
          .eq('game_id', gameId)
        if (tsData) {
          setTsList(tsData.map((r: any) => ({ territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies })))
        }
      }

      // Fetch events
      const { data: evData } = await sb.from('game_events')
        .select('id, event_type, event_data, turn_number, created_at, game_player_id')
        .eq('game_id', gameId).order('created_at', { ascending: true }).limit(100)
      if (evData) {
        setEvents(evData.map((e: any) => ({
          id: e.id, eventType: e.event_type, eventData: e.event_data,
          turnNumber: e.turn_number, createdAt: e.created_at, gamePlayerId: e.game_player_id,
        })))
      }

      // Auto-join if waiting
      if (gd.status === 'waiting' && player) {
        try {
          await joinGame(gameId, { id: player.id, username: player.username, avatar_url: player.avatar_url })
          await fetchPlayers()
          // Re-fetch game (may have started)
          const { data: g2 } = await sb.from('games')
            .select('status, current_players, current_turn_player_id, turn_number, turn_deadline')
            .eq('id', gameId).single()
          if (g2) {
            setGame(prev => prev ? { ...prev, status: g2.status, currentPlayers: g2.current_players, currentTurnPlayerId: g2.current_turn_player_id, turnNumber: g2.turn_number, turnDeadline: g2.turn_deadline } : null)
            if (g2.status === 'active') {
              const { data: tsData } = await sb.from('territory_states')
                .select('territory_id, owner_player_id, armies').eq('game_id', gameId)
              if (tsData) setTsList(tsData.map((r: any) => ({ territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies })))
            }
          }
        } catch { /* already joined or game started */ }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load game')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPlayers() {
    const { data: pData } = await sb.from('game_players')
      .select('id, player_id, username, color, is_ai, turn_order, card_count, is_eliminated')
      .eq('game_id', gameId).order('turn_order')
    if (pData) {
      setPlayers(pData.map((p: any) => ({
        id: p.id, playerId: p.player_id, username: p.username, color: p.color,
        isAi: p.is_ai, turnOrder: p.turn_order, cardCount: p.card_count, isEliminated: p.is_eliminated,
      })))
    }
  }

  useEffect(() => { fetchAll() }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calculate deploy armies when turn starts ────────────────────────────────
  useEffect(() => {
    if (game?.status === 'active' && isMyTurn && phase === 'deploy' && mapTerritories.length && tsMap.size) {
      const armies = calcDeployArmies(myGP!.id, mapTerritories, bonusGroups, tsMap)
      setDeployLeft(armies)
    }
  }, [game?.currentTurnPlayerId, game?.turnNumber, phase, tsMap.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = sb.channel(`game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'territory_states', filter: `game_id=eq.${gameId}` }, (payload) => {
        const r = payload.new as any
        setTsList(prev => {
          const next = prev.filter(ts => ts.territoryId !== r.territory_id)
          next.push({ territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies })
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        const r = payload.new as any
        setGame(prev => prev ? {
          ...prev, status: r.status, currentPlayers: r.current_players,
          currentTurnPlayerId: r.current_turn_player_id, turnNumber: r.turn_number,
          turnDeadline: r.turn_deadline, winnerId: r.winner_id,
        } : null)
        // Reset phase for new turn
        setPhase('deploy')
        setAttackFrom(null); setAttackTo(null)
        setFortifyFrom(null); setFortifyTo(null)
        setConqueredThisTurn(false); setLastDice(null)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` }, (payload) => {
        const e = payload.new as any
        setEvents(prev => [...prev, {
          id: e.id, eventType: e.event_type, eventData: e.event_data,
          turnNumber: e.turn_number, createdAt: e.created_at, gamePlayerId: e.game_player_id,
        }])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, () => {
        fetchPlayers()
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Territory click handler ─────────────────────────────────────────────────
  const handleTerritoryClick = useCallback((tid: string) => {
    if (!isMyTurn || actionLock || !myGP) return
    const ts = tsMap.get(tid)
    if (!ts) return
    const isMine = ts.ownerId === myGP.id

    if (phase === 'deploy') {
      if (!isMine || deployLeft <= 0) return
      doDeploy(tid)
    } else if (phase === 'attack') {
      if (!attackFrom) {
        // Select source: must own and have 2+ armies
        if (isMine && ts.armies >= 2) setAttackFrom(tid)
      } else if (attackFrom === tid) {
        // Deselect
        setAttackFrom(null); setAttackTo(null); setLastDice(null)
      } else if (!attackTo) {
        // Select target: must be adjacent enemy
        const src = mapTerritories.find(t => t.id === attackFrom)
        if (!isMine && src?.adjacent_ids?.includes(tid)) {
          setAttackTo(tid)
          setAttackDiceCount(Math.min(3, (tsMap.get(attackFrom)?.armies ?? 2) - 1))
        }
      } else if (attackTo === tid) {
        setAttackTo(null); setLastDice(null)
      }
    } else if (phase === 'fortify') {
      if (!fortifyFrom) {
        if (isMine && ts.armies >= 2) setFortifyFrom(tid)
      } else if (fortifyFrom === tid) {
        setFortifyFrom(null); setFortifyTo(null)
      } else if (!fortifyTo) {
        if (isMine && areConnected(fortifyFrom, tid, mapTerritories, myGP.id, tsMap)) {
          setFortifyTo(tid)
          setFortifyAmount(1)
        }
      } else if (fortifyTo === tid) {
        setFortifyTo(null)
      }
    }
  }, [isMyTurn, actionLock, myGP, phase, deployLeft, attackFrom, attackTo, fortifyFrom, fortifyTo, tsMap, mapTerritories]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deploy action ───────────────────────────────────────────────────────────
  async function doDeploy(tid: string) {
    setActionLock(true)
    try {
      const ts = tsMap.get(tid)!
      await sb.from('territory_states')
        .update({ armies: ts.armies + 1 })
        .eq('game_id', gameId).eq('territory_id', tid)
      setTsList(prev => prev.map(t => t.territoryId === tid ? { ...t, armies: t.armies + 1 } : t))
      const newLeft = deployLeft - 1
      setDeployLeft(newLeft)

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: myGP!.id, event_type: 'deploy', turn_number: game!.turnNumber,
        event_data: { territory_id: tid, armies_placed: 1 },
      })

      if (newLeft <= 0) setPhase('attack')
    } finally { setActionLock(false) }
  }

  // ── Attack action ───────────────────────────────────────────────────────────
  async function doAttack() {
    if (!attackFrom || !attackTo || actionLock) return
    setActionLock(true)
    try {
      const srcTs = tsMap.get(attackFrom)!
      const tgtTs = tsMap.get(attackTo)!
      const atkCount = Math.min(attackDiceCount, srcTs.armies - 1)
      const defCount = Math.min(2, tgtTs.armies)

      const { data: dice, error: dErr } = await sb.rpc('roll_dice', { attack_count: atkCount, defend_count: defCount })
      if (dErr) throw dErr
      setLastDice(dice)

      const newSrcArmies = srcTs.armies - dice.attacker_losses
      const newTgtArmies = tgtTs.armies - dice.defender_losses

      if (newTgtArmies <= 0) {
        // Territory conquered!
        const moveArmies = atkCount // move attacking dice count
        await Promise.all([
          sb.from('territory_states').update({ armies: newSrcArmies - moveArmies }).eq('game_id', gameId).eq('territory_id', attackFrom),
          sb.from('territory_states').update({ owner_player_id: myGP!.id, armies: moveArmies }).eq('game_id', gameId).eq('territory_id', attackTo),
        ])
        setTsList(prev => prev.map(t => {
          if (t.territoryId === attackFrom) return { ...t, armies: newSrcArmies - moveArmies }
          if (t.territoryId === attackTo) return { ...t, ownerId: myGP!.id, armies: moveArmies }
          return t
        }))
        setConqueredThisTurn(true)

        // Check if defender eliminated
        const defenderId = tgtTs.ownerId
        const defenderStillHas = tsList.filter(ts => ts.ownerId === defenderId && ts.territoryId !== attackTo).length
        if (defenderStillHas === 0 && defenderId) {
          await sb.from('game_players').update({ is_eliminated: true, eliminated_at: new Date().toISOString() })
            .eq('game_id', gameId).eq('id', defenderId)
        }

        // Check win (all territories owned)
        const totalTerritories = mapTerritories.length
        const myTerritories = tsList.filter(ts => ts.ownerId === myGP!.id).length + 1 // +1 for just conquered
        if (myTerritories >= totalTerritories) {
          await sb.from('games').update({ status: 'finished', winner_id: myGP!.playerId }).eq('id', gameId)
          await sb.from('game_events').insert({
            game_id: gameId, game_player_id: myGP!.id, event_type: 'win', turn_number: game!.turnNumber,
            event_data: { winner_player_id: myGP!.playerId },
          })
        }

        setAttackFrom(null); setAttackTo(null)
      } else {
        // Update armies
        await Promise.all([
          sb.from('territory_states').update({ armies: newSrcArmies }).eq('game_id', gameId).eq('territory_id', attackFrom),
          sb.from('territory_states').update({ armies: newTgtArmies }).eq('game_id', gameId).eq('territory_id', attackTo),
        ])
        setTsList(prev => prev.map(t => {
          if (t.territoryId === attackFrom) return { ...t, armies: newSrcArmies }
          if (t.territoryId === attackTo) return { ...t, armies: newTgtArmies }
          return t
        }))
        // Update dice count for next roll
        setAttackDiceCount(Math.min(3, newSrcArmies - 1))
        if (newSrcArmies <= 1) { setAttackFrom(null); setAttackTo(null) }
      }

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: myGP!.id, event_type: 'attack', turn_number: game!.turnNumber,
        event_data: { from: attackFrom, to: attackTo, ...dice, conquered: newTgtArmies <= 0 },
      })
    } finally { setActionLock(false) }
  }

  // ── Fortify action ──────────────────────────────────────────────────────────
  async function doFortify() {
    if (!fortifyFrom || !fortifyTo || actionLock) return
    setActionLock(true)
    try {
      const src = tsMap.get(fortifyFrom)!
      const tgt = tsMap.get(fortifyTo)!
      const amt = Math.min(fortifyAmount, src.armies - 1)
      await Promise.all([
        sb.from('territory_states').update({ armies: src.armies - amt }).eq('game_id', gameId).eq('territory_id', fortifyFrom),
        sb.from('territory_states').update({ armies: tgt.armies + amt }).eq('game_id', gameId).eq('territory_id', fortifyTo),
      ])
      setTsList(prev => prev.map(t => {
        if (t.territoryId === fortifyFrom) return { ...t, armies: t.armies - amt }
        if (t.territoryId === fortifyTo) return { ...t, armies: t.armies + amt }
        return t
      }))
      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: myGP!.id, event_type: 'fortify', turn_number: game!.turnNumber,
        event_data: { from: fortifyFrom, to: fortifyTo, armies_moved: amt },
      })
      // End turn after fortify
      await advanceTurn()
    } finally { setActionLock(false) }
  }

  // ── End turn / advance ──────────────────────────────────────────────────────
  async function advanceTurn() {
    if (!game) return
    const activePlayers = players.filter(p => !p.isEliminated).sort((a, b) => a.turnOrder - b.turnOrder)
    const currentIdx = activePlayers.findIndex(p => p.id === game.currentTurnPlayerId)
    const nextPlayer = activePlayers[(currentIdx + 1) % activePlayers.length]

    const deadlineMs = game.mode === 'lightning' ? 60_000 : game.mode === 'slow_hour' ? 3_600_000 : 86_400_000
    await sb.from('games').update({
      current_turn_player_id: nextPlayer.id,
      turn_number: game.turnNumber + 1,
      turn_deadline: new Date(Date.now() + deadlineMs).toISOString(),
    }).eq('id', gameId)

    setPhase('deploy')
    setAttackFrom(null); setAttackTo(null)
    setFortifyFrom(null); setFortifyTo(null)
    setConqueredThisTurn(false); setLastDice(null)
  }

  async function skipToFortify() {
    setPhase('fortify')
    setAttackFrom(null); setAttackTo(null); setLastDice(null)
  }

  async function skipFortifyEndTurn() {
    await advanceTurn()
  }

  // ── Bot AI ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!game || game.status !== 'active' || !isCreator || !currentTP?.isAi || botRunning.current) return

    const timer = setTimeout(async () => {
      if (botRunning.current) return
      botRunning.current = true
      try {
        await runBotTurn(currentTP.id)
      } catch (e) { console.error('Bot error:', e) }
      finally { botRunning.current = false }
    }, 1200)

    return () => clearTimeout(timer)
  }, [game?.currentTurnPlayerId, game?.turnNumber, game?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runBotTurn(botId: string) {
    // Deploy: place armies on border territories
    const deployCount = calcDeployArmies(botId, mapTerritories, bonusGroups, tsMap)
    const myTs = tsList.filter(ts => ts.ownerId === botId)
    const borders = myTs.filter(ts => {
      const t = mapTerritories.find(mt => mt.id === ts.territoryId)
      return t?.adjacent_ids?.some(aid => tsMap.get(aid)?.ownerId !== botId)
    })
    const targets = borders.length > 0 ? borders : myTs
    for (let i = 0; i < deployCount; i++) {
      const pick = targets[Math.floor(Math.random() * targets.length)]
      await sb.from('territory_states').update({ armies: (tsMap.get(pick.territoryId)?.armies ?? 1) + 1 })
        .eq('game_id', gameId).eq('territory_id', pick.territoryId)
      pick.armies = (pick.armies || 1) + 1
      // Also update tsMap locally
      setTsList(prev => prev.map(t => t.territoryId === pick.territoryId ? { ...t, armies: pick.armies } : t))
      await new Promise(r => setTimeout(r, 200))
    }

    // Attack: up to 5 attacks with advantage
    for (let atk = 0; atk < 5; atk++) {
      // Re-read state
      const { data: freshTs } = await sb.from('territory_states')
        .select('territory_id, owner_player_id, armies').eq('game_id', gameId)
      if (!freshTs) break
      const freshMap = new Map(freshTs.map((r: any) => [r.territory_id, { territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies }]))

      // Find best attack
      let bestSrc: string | null = null, bestTgt: string | null = null, bestAdv = 0
      for (const ts of freshTs) {
        if (ts.owner_player_id !== botId || ts.armies < 3) continue
        const terr = mapTerritories.find(t => t.id === ts.territory_id)
        for (const adj of terr?.adjacent_ids ?? []) {
          const enemy = freshMap.get(adj)
          if (enemy && enemy.ownerId !== botId) {
            const advantage = ts.armies - enemy.armies
            if (advantage > bestAdv) { bestAdv = advantage; bestSrc = ts.territory_id; bestTgt = adj }
          }
        }
      }
      if (!bestSrc || !bestTgt || bestAdv < 1) break

      const srcArmies = freshMap.get(bestSrc)!.armies
      const tgtArmies = freshMap.get(bestTgt)!.armies
      const atkCount = Math.min(3, srcArmies - 1)
      const defCount = Math.min(2, tgtArmies)

      const { data: dice } = await sb.rpc('roll_dice', { attack_count: atkCount, defend_count: defCount })
      if (!dice) break

      const newSrc = srcArmies - dice.attacker_losses
      const newTgt = tgtArmies - dice.defender_losses

      if (newTgt <= 0) {
        const move = atkCount
        await Promise.all([
          sb.from('territory_states').update({ armies: newSrc - move }).eq('game_id', gameId).eq('territory_id', bestSrc),
          sb.from('territory_states').update({ owner_player_id: botId, armies: move }).eq('game_id', gameId).eq('territory_id', bestTgt),
        ])
        // Check elimination
        const defender = freshMap.get(bestTgt)!.ownerId
        const defLeft = freshTs.filter(t => t.owner_player_id === defender && t.territory_id !== bestTgt).length
        if (defLeft === 0 && defender) {
          await sb.from('game_players').update({ is_eliminated: true }).eq('game_id', gameId).eq('id', defender)
        }
        // Check win
        const botOwns = freshTs.filter(t => t.owner_player_id === botId).length + 1
        if (botOwns >= mapTerritories.length) {
          const botPlayer = players.find(p => p.id === botId)
          await sb.from('games').update({ status: 'finished', winner_id: botPlayer?.playerId ?? null }).eq('id', gameId)
          return
        }
      } else {
        await Promise.all([
          sb.from('territory_states').update({ armies: newSrc }).eq('game_id', gameId).eq('territory_id', bestSrc),
          sb.from('territory_states').update({ armies: newTgt }).eq('game_id', gameId).eq('territory_id', bestTgt),
        ])
      }

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: botId, event_type: 'attack', turn_number: game!.turnNumber,
        event_data: { from: bestSrc, to: bestTgt, ...dice, conquered: newTgt <= 0 },
      })
      await new Promise(r => setTimeout(r, 600))
    }

    // End bot turn
    const activePlayers = players.filter(p => !p.isEliminated).sort((a, b) => a.turnOrder - b.turnOrder)
    const curIdx = activePlayers.findIndex(p => p.id === botId)
    const nextP = activePlayers[(curIdx + 1) % activePlayers.length]
    const deadlineMs = game!.mode === 'lightning' ? 60_000 : game!.mode === 'slow_hour' ? 3_600_000 : 86_400_000
    await sb.from('games').update({
      current_turn_player_id: nextP.id,
      turn_number: game!.turnNumber + 1,
      turn_deadline: new Date(Date.now() + deadlineMs).toISOString(),
    }).eq('id', gameId)
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="h-screen bg-crusader-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
          <p className="text-crusader-gold/60 font-cinzel text-sm tracking-widest">Loading Battle...</p>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="h-screen bg-crusader-void flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-cinzel mb-4">{error ?? 'Game not found'}</p>
          <Link href="/lobby"><Button variant="outline" icon={<ArrowLeft size={14} />}>Back to Lobby</Button></Link>
        </div>
      </div>
    )
  }

  // ── Waiting Room ────────────────────────────────────────────────────────────
  if (game.status === 'waiting') {
    return (
      <div className="h-screen bg-crusader-void flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-6 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
          <h1 className="font-cinzel text-2xl font-bold text-crusader-gold mb-2">{game.name}</h1>
          <p className="text-crusader-gold/50 font-cinzel text-sm tracking-widest mb-8">WAITING FOR PLAYERS</p>
          <div className="flex justify-center gap-3 mb-8">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-crusader-gold/20" style={{ borderColor: p.color + '40' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <span className="text-sm font-cinzel text-crusader-gold/80">{p.username}</span>
                {p.isAi && <span className="text-[9px] uppercase text-crusader-gold/40 border border-crusader-gold/20 px-1 rounded">AI</span>}
              </div>
            ))}
            {Array.from({ length: game.maxPlayers - players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-crusader-gold/10">
                <div className="w-3 h-3 rounded-full border border-crusader-gold/20" />
                <span className="text-sm font-cinzel text-crusader-gold/20">Open</span>
              </div>
            ))}
          </div>
          <p className="text-crusader-gold/30 text-xs font-cinzel">
            {game.currentPlayers}/{game.maxPlayers} players · Game starts when full
          </p>
          <Link href="/lobby" className="inline-block mt-6">
            <Button variant="outline" size="sm" icon={<ArrowLeft size={12} />}>Back to Lobby</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Finished ────────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = players.find(p => p.playerId === game.winnerId || p.id === game.winnerId)
    return (
      <div className="h-screen bg-crusader-void flex flex-col">
        <main className="flex-1 flex pt-20">
          <div className="flex-1 relative">
            <GameMap territories={mapTerritories} tsMap={tsMap} playerMap={playerMap}
              phase="deploy" selectedId={null} attackFrom={null} attackTo={null}
              fortifyFrom={null} fortifyTo={null} myGamePlayerId={myGP?.id ?? null}
              isMyTurn={false} onClick={() => {}} />
            {/* Victory overlay */}
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <Crown size={64} className="mx-auto mb-4" style={{ color: winner?.color ?? '#C9A84C' }} />
                <h1 className="font-cinzel text-4xl font-bold tracking-[6px] mb-2" style={{ color: winner?.color ?? '#C9A84C' }}>
                  VICTORY
                </h1>
                <p className="font-cinzel text-xl text-crusader-gold/70 mb-8">{winner?.username ?? 'Unknown'} has conquered the world!</p>
                <Link href="/lobby"><Button icon={<Sword size={16} />}>Play Again</Button></Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Active Game ─────────────────────────────────────────────────────────────
  const maxAttackDice = attackFrom ? Math.min(3, (tsMap.get(attackFrom)?.armies ?? 2) - 1) : 1
  const maxFortifyAmt = fortifyFrom ? (tsMap.get(fortifyFrom)?.armies ?? 1) - 1 : 0

  return (
    <div className="h-screen bg-crusader-void flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-12 mt-20 flex items-center justify-between px-5 border-b border-crusader-gold/10" style={{ background: 'rgba(8,6,4,0.90)' }}>
        <div className="flex items-center gap-4">
          <Link href="/lobby" className="text-crusader-gold/30 hover:text-crusader-gold transition-colors"><ArrowLeft size={16} /></Link>
          <h1 className="font-cinzel text-sm font-bold text-crusader-gold tracking-widest">{game.name}</h1>
          <span className="text-[10px] font-cinzel text-crusader-gold/30 tracking-wider">TURN {game.turnNumber}</span>
        </div>

        {/* Player strip */}
        <div className="flex items-center gap-2">
          {players.filter(p => !p.isEliminated).map(p => {
            const isCurrent = p.id === game.currentTurnPlayerId
            const tCount = tsList.filter(ts => ts.ownerId === p.id).length
            return (
              <div key={p.id} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-cinzel tracking-wide border transition-all ${
                isCurrent ? 'border-current opacity-100 shadow-[0_0_8px_currentColor]' : 'border-transparent opacity-40'
              }`} style={{ color: p.color, borderColor: isCurrent ? p.color : 'transparent' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span>{p.username}</span>
                <span className="opacity-50">{tCount}t</span>
              </div>
            )
          })}
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2">
          {isMyTurn && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-crusader-gold/40 bg-crusader-gold/10">
              {phase === 'deploy' && <Shield size={11} className="text-crusader-gold" />}
              {phase === 'attack' && <Crosshair size={11} className="text-red-400" />}
              {phase === 'fortify' && <ArrowRightLeft size={11} className="text-blue-400" />}
              <span className="text-[10px] font-cinzel tracking-wider text-crusader-gold">
                {phase === 'deploy' ? `DEPLOY (${deployLeft})` : phase === 'attack' ? 'ATTACK' : 'FORTIFY'}
              </span>
            </div>
          )}
          {!isMyTurn && currentTP && (
            <span className="text-[10px] font-cinzel text-crusader-gold/40 tracking-wider">
              {currentTP.username}&apos;s turn{currentTP.isAi ? ' (AI)' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <GameMap
            territories={mapTerritories} tsMap={tsMap} playerMap={playerMap}
            phase={phase} selectedId={null}
            attackFrom={attackFrom} attackTo={attackTo}
            fortifyFrom={fortifyFrom} fortifyTo={fortifyTo}
            myGamePlayerId={myGP?.id ?? null} isMyTurn={isMyTurn}
            onClick={handleTerritoryClick}
          />
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        <div className="w-72 flex flex-col border-l border-crusader-gold/10 overflow-hidden" style={{ background: 'rgba(6,5,3,0.92)' }}>

          {/* Action panel */}
          {isMyTurn && (
            <div className="shrink-0 p-4 border-b border-crusader-gold/10 space-y-3">
              {phase === 'deploy' && (
                <div className="text-center">
                  <p className="font-cinzel text-xs text-crusader-gold/60 mb-1">Click your territories to deploy</p>
                  <p className="font-cinzel text-2xl font-bold text-crusader-gold">{deployLeft}</p>
                  <p className="font-cinzel text-[10px] text-crusader-gold/35 tracking-widest">ARMIES REMAINING</p>
                </div>
              )}

              {phase === 'attack' && (
                <>
                  {!attackFrom && (
                    <p className="font-cinzel text-xs text-crusader-gold/60 text-center">Select a territory to attack from (2+ armies)</p>
                  )}
                  {attackFrom && !attackTo && (
                    <p className="font-cinzel text-xs text-red-400/70 text-center">Select an adjacent enemy territory</p>
                  )}
                  {attackFrom && attackTo && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-cinzel">
                        <span className="text-crusader-gold/60">Attack dice:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3].map(n => (
                            <button key={n} disabled={n > maxAttackDice}
                              onClick={() => setAttackDiceCount(n)}
                              className={`w-7 h-7 rounded border text-xs font-bold transition-all ${
                                attackDiceCount === n ? 'border-red-400 bg-red-400/20 text-red-400' : 'border-crusader-gold/20 text-crusader-gold/40'
                              } ${n > maxAttackDice ? 'opacity-20' : ''}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button fullWidth size="sm" onClick={doAttack} loading={actionLock}
                        icon={<Dices size={14} />} className="!bg-red-900/30 !border-red-400/40 hover:!bg-red-900/50 !text-red-300">
                        Roll Attack
                      </Button>
                    </div>
                  )}
                  {/* Dice result */}
                  {lastDice && (
                    <div className="bg-crusader-void/50 rounded-lg p-3 border border-crusader-gold/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {lastDice.attack_dice.sort((a: number, b: number) => b - a).map((d: number, i: number) => (
                            <div key={i} className="w-6 h-6 rounded bg-red-700 text-white text-xs font-bold flex items-center justify-center">{d}</div>
                          ))}
                        </div>
                        <span className="text-[10px] text-crusader-gold/30 font-cinzel">vs</span>
                        <div className="flex gap-1">
                          {lastDice.defend_dice.sort((a: number, b: number) => b - a).map((d: number, i: number) => (
                            <div key={i} className="w-6 h-6 rounded bg-blue-700 text-white text-xs font-bold flex items-center justify-center">{d}</div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] font-cinzel text-crusader-gold/50 text-center">
                        Attacker lost {lastDice.attacker_losses} · Defender lost {lastDice.defender_losses}
                      </p>
                    </div>
                  )}
                  <Button fullWidth size="sm" variant="outline" onClick={skipToFortify}>
                    Done Attacking
                  </Button>
                </>
              )}

              {phase === 'fortify' && (
                <>
                  {!fortifyFrom && (
                    <p className="font-cinzel text-xs text-crusader-gold/60 text-center">Select a territory to move armies from</p>
                  )}
                  {fortifyFrom && !fortifyTo && (
                    <p className="font-cinzel text-xs text-blue-400/70 text-center">Select a connected territory to move to</p>
                  )}
                  {fortifyFrom && fortifyTo && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-cinzel">
                        <span className="text-crusader-gold/60">Move armies:</span>
                        <div className="flex items-center gap-2">
                          <input type="range" min={1} max={maxFortifyAmt} value={fortifyAmount}
                            onChange={e => setFortifyAmount(Number(e.target.value))}
                            className="w-20 accent-blue-400" />
                          <span className="text-blue-400 font-bold w-5 text-right">{fortifyAmount}</span>
                        </div>
                      </div>
                      <Button fullWidth size="sm" onClick={doFortify} loading={actionLock}
                        icon={<ArrowRightLeft size={14} />} className="!border-blue-400/40 !text-blue-300">
                        Fortify &amp; End Turn
                      </Button>
                    </div>
                  )}
                  <Button fullWidth size="sm" variant="outline" onClick={skipFortifyEndTurn}>
                    Skip &amp; End Turn
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Player stats */}
          <div className="shrink-0 p-4 border-b border-crusader-gold/10">
            <h3 className="font-cinzel text-[10px] text-crusader-gold/35 tracking-[0.2em] uppercase mb-2">COMMANDERS</h3>
            <div className="space-y-1.5">
              {players.map(p => {
                const tCount = tsList.filter(ts => ts.ownerId === p.id).length
                const aCount = tsList.filter(ts => ts.ownerId === p.id).reduce((s, ts) => s + ts.armies, 0)
                const isCurrent = p.id === game.currentTurnPlayerId
                return (
                  <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded transition-all ${
                    p.isEliminated ? 'opacity-25 line-through' : isCurrent ? 'bg-crusader-gold/5' : ''
                  }`}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color, boxShadow: isCurrent ? `0 0 6px ${p.color}` : 'none' }} />
                    <span className="text-[11px] font-cinzel text-crusader-gold/70 flex-1 truncate">{p.username}</span>
                    {p.isAi && <span className="text-[8px] uppercase text-crusader-gold/25 border border-crusader-gold/10 px-1 rounded">AI</span>}
                    <span className="text-[10px] text-crusader-gold/30 font-cinzel">{tCount}t · {aCount}a</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bonus groups */}
          {bonusGroups.length > 0 && (
            <div className="shrink-0 p-4 border-b border-crusader-gold/10">
              <h3 className="font-cinzel text-[10px] text-crusader-gold/35 tracking-[0.2em] uppercase mb-2">BONUS REGIONS</h3>
              <div className="space-y-1">
                {bonusGroups.map(bg => {
                  const owned = myGP ? bg.territory_ids.filter(tid => tsMap.get(tid)?.ownerId === myGP.id).length : 0
                  return (
                    <div key={bg.id} className="flex items-center justify-between text-[10px] font-cinzel">
                      <span className="text-crusader-gold/50 truncate flex-1">{bg.name}</span>
                      <span className={owned === bg.territory_ids.length ? 'text-crusader-gold font-bold' : 'text-crusader-gold/25'}>
                        {owned}/{bg.territory_ids.length} · +{bg.bonus_armies}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Event log */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-none min-h-0">
            <h3 className="font-cinzel text-[10px] text-crusader-gold/35 tracking-[0.2em] uppercase mb-2">BATTLE LOG</h3>
            <div className="space-y-1">
              {events.slice(-30).reverse().map(ev => {
                const pName = ev.gamePlayerId ? playerMap.get(ev.gamePlayerId)?.username ?? '?' : 'System'
                let text = ''
                if (ev.eventType === 'start') text = 'Game started!'
                else if (ev.eventType === 'deploy') text = `${pName} deployed to ${ev.eventData?.territory_id}`
                else if (ev.eventType === 'attack') text = `${pName} attacked ${ev.eventData?.to} from ${ev.eventData?.from}${ev.eventData?.conquered ? ' — CONQUERED!' : ''}`
                else if (ev.eventType === 'fortify') text = `${pName} fortified ${ev.eventData?.to}`
                else if (ev.eventType === 'win') text = `${pName} wins the game!`
                else text = `${pName}: ${ev.eventType}`
                return (
                  <div key={ev.id} className={`text-[10px] font-cinzel leading-relaxed ${
                    ev.eventType === 'attack' ? (ev.eventData?.conquered ? 'text-crusader-gold/70' : 'text-red-400/50')
                    : ev.eventType === 'win' ? 'text-crusader-gold'
                    : 'text-crusader-gold/35'
                  }`}>
                    {text}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
