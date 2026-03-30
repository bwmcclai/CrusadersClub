'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getSupabaseClient } from '@/lib/supabase'
import { joinGame } from '@/lib/gameService'
import { useAppStore } from '@/lib/store'
import type { Territory, BonusGroup, GameMode } from '@/types'
import type { ArmyBadgeDef } from '@/components/three/EarthGlobe'
import { ArrowLeft, Sword, Shield, Crosshair, ArrowRightLeft, Crown, Dices, Layers } from 'lucide-react'
import Button from '@/components/ui/Button'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), { ssr: false })

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

interface CardData {
  id: string
  territoryId: string
  cardType: 'infantry' | 'cavalry' | 'artillery' | 'wild'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

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
// Game Globe Map
// ═══════════════════════════════════════════════════════════════════════════════

function GameGlobeMap({
  territories, tsMap, playerMap,
  attackFrom, attackTo, fortifyFrom, fortifyTo,
  isMyTurn, onClick,
}: {
  territories: Territory[]
  tsMap: Map<string, TS>
  playerMap: Map<string, GP>
  attackFrom: string | null
  attackTo: string | null
  fortifyFrom: string | null
  fortifyTo: string | null
  isMyTurn: boolean
  onClick: (id: string) => void
}) {
  const ownerColors = useMemo(() => {
    const result: Record<string, string> = {}
    territories.forEach(t => {
      const ts = tsMap.get(t.id)
      const owner = ts?.ownerId ? playerMap.get(ts.ownerId) : null
      result[t.id] = owner?.color ?? '#2a2a3a'
    })
    return result
  }, [territories, tsMap, playerMap])

  const attackFromAdj = useMemo(() => {
    if (!attackFrom) return new Set<string>()
    const t = territories.find(t => t.id === attackFrom)
    return new Set(t?.adjacent_ids ?? [])
  }, [attackFrom, territories])

  const armyBadges = useMemo((): ArmyBadgeDef[] => {
    return territories.map(t => {
      const ts = tsMap.get(t.id)
      const owner = ts?.ownerId ? playerMap.get(ts.ownerId) : null
      const lat = 90 - t.seed[1] / 600 * 180
      const lon = t.seed[0] / 1200 * 360 - 180
      let highlight: string | undefined
      if (attackFrom === t.id) highlight = '#FFDD00'
      else if (attackTo === t.id) highlight = '#FF4444'
      else if (attackFrom && !attackTo && attackFromAdj.has(t.id) && ts?.ownerId !== tsMap.get(attackFrom)?.ownerId) highlight = '#FF6666'
      else if (fortifyFrom === t.id) highlight = '#00FF88'
      else if (fortifyTo === t.id) highlight = '#00AAFF'
      return { id: t.id, lat, lon, armies: ts?.armies ?? 0, color: owner?.color ?? '#555', highlight }
    })
  }, [territories, tsMap, playerMap, attackFrom, attackTo, fortifyFrom, fortifyTo, attackFromAdj])

  return (
    <EarthGlobe
      territories={territories}
      ownerColors={ownerColors}
      armyBadges={armyBadges}
      onTerritoryClick={isMyTurn ? onClick : undefined}
      showContinentLabels={false}
      cameraDistance={2.2}
      className="w-full h-full"
    />
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
  const [myCards, setMyCards] = useState<CardData[]>([])
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [showCards, setShowCards] = useState(false)
  const [tradeCount, setTradeCount] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
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

      // Fetch trade count from game settings
      setTradeCount(gd.settings?.trade_count ?? 0)

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

  async function fetchMyCards() {
    if (!myGP) return
    const { data } = await sb.from('cards')
      .select('id, territory_id, card_type')
      .eq('game_id', gameId)
      .eq('held_by_player_id', myGP.id)
    if (data) {
      setMyCards(data.map((c: any) => ({ id: c.id, territoryId: c.territory_id, cardType: c.card_type })))
    }
  }

  useEffect(() => { fetchAll() }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cards when player is known and turn changes
  useEffect(() => {
    if (myGP && game?.status === 'active') fetchMyCards()
  }, [myGP?.id, game?.turnNumber]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setActionError(null)
    try {
      const ts = tsMap.get(tid)!
      const { error: uErr } = await sb.from('territory_states')
        .update({ armies: ts.armies + 1 })
        .eq('game_id', gameId).eq('territory_id', tid)
      if (uErr) throw uErr
      setTsList(prev => prev.map(t => t.territoryId === tid ? { ...t, armies: t.armies + 1 } : t))
      const newLeft = deployLeft - 1
      setDeployLeft(newLeft)

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: myGP!.id, event_type: 'deploy', turn_number: game!.turnNumber,
        event_data: { territory_id: tid, armies_placed: 1 },
      })

      if (newLeft <= 0) setPhase('attack')
    } catch (err: any) {
      setActionError(err?.message ?? 'Deploy failed')
    } finally { setActionLock(false) }
  }

  // ── Attack action ───────────────────────────────────────────────────────────
  async function doAttack() {
    if (!attackFrom || !attackTo || actionLock) return
    setActionLock(true)
    setActionError(null)
    try {
      // Validate adjacency before executing attack
      const srcTerr = mapTerritories.find(t => t.id === attackFrom)
      if (!srcTerr?.adjacent_ids?.includes(attackTo)) {
        throw new Error('Invalid attack: territories are not adjacent')
      }

      const srcTs = tsMap.get(attackFrom)!
      const tgtTs = tsMap.get(attackTo)!

      // Validate ownership
      if (srcTs.ownerId !== myGP?.id) throw new Error('Invalid attack: you do not own the source territory')
      if (tgtTs.ownerId === myGP?.id) throw new Error('Invalid attack: cannot attack your own territory')
      if (srcTs.armies < 2) throw new Error('Invalid attack: need at least 2 armies to attack')

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
    } catch (err: any) {
      setActionError(err?.message ?? 'Attack failed')
    } finally { setActionLock(false) }
  }

  // ── Fortify action ──────────────────────────────────────────────────────────
  async function doFortify() {
    if (!fortifyFrom || !fortifyTo || actionLock) return
    setActionLock(true)
    setActionError(null)
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
    } catch (err: any) {
      setActionError(err?.message ?? 'Fortify failed')
    } finally { setActionLock(false) }
  }

  // ── Card trading ────────────────────────────────────────────────────────────
  function isValidCardSet(cards: CardData[]): boolean {
    if (cards.length !== 3) return false
    const types = cards.map(c => c.cardType)
    const wilds = types.filter(t => t === 'wild').length
    const nonWild = types.filter(t => t !== 'wild')
    // Three of a kind
    if (nonWild.length + wilds === 3 && new Set(nonWild).size <= 1) return true
    // One of each
    if (wilds === 0 && new Set(types).size === 3) return true
    // With wilds filling in
    if (wilds >= 1) {
      const unique = new Set(nonWild)
      if (unique.size + wilds >= 3) return true
    }
    return false
  }

  function toggleCardSelection(cardId: string) {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId)
      if (prev.length >= 3) return prev
      return [...prev, cardId]
    })
  }

  async function tradeCards() {
    if (selectedCards.length !== 3 || !myGP || actionLock) return
    const selected = myCards.filter(c => selectedCards.includes(c.id))
    if (!isValidCardSet(selected)) return

    setActionLock(true)
    try {
      // Calculate armies from trade using RPC
      const spoilsMode = game?.settings?.spoils_mode ?? 'escalating'
      const { data: armies, error: rpcErr } = await sb.rpc('card_trade_armies', {
        trade_count: tradeCount + 1,
        spoils_mode: spoilsMode,
      })
      if (rpcErr) throw rpcErr

      // Return cards to deck
      for (const cardId of selectedCards) {
        await sb.from('cards').update({ held_by_player_id: null }).eq('id', cardId)
      }

      // Update card count
      await sb.from('game_players').update({ card_count: Math.max(0, myCards.length - 3) })
        .eq('game_id', gameId).eq('id', myGP.id)

      // Increment trade count in game settings
      const newTradeCount = tradeCount + 1
      await sb.from('games').update({
        settings: { ...game?.settings, trade_count: newTradeCount },
      }).eq('id', gameId)
      setTradeCount(newTradeCount)

      // Add bonus armies to deploy
      const bonusArmies = armies ?? 4
      setDeployLeft(prev => prev + bonusArmies)

      // Check for territory bonus: +2 if you own a territory on any traded card
      let territoryBonus = 0
      for (const card of selected) {
        if (card.cardType !== 'wild' && tsMap.get(card.territoryId)?.ownerId === myGP.id) {
          territoryBonus = 2
          break
        }
      }
      if (territoryBonus > 0) setDeployLeft(prev => prev + territoryBonus)

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: myGP.id, event_type: 'card_trade', turn_number: game!.turnNumber,
        event_data: { cards_traded: selectedCards, armies_received: bonusArmies + territoryBonus },
      })

      setSelectedCards([])
      setMyCards(prev => prev.filter(c => !selectedCards.includes(c.id)))
      setShowCards(false)
    } finally { setActionLock(false) }
  }

  // ── End turn / advance ──────────────────────────────────────────────────────
  async function advanceTurn() {
    if (!game) return

    // Draw a card if conquered a territory this turn
    if (conqueredThisTurn && myGP) {
      const { data: topCard } = await sb.from('cards')
        .select('id, territory_id, card_type')
        .eq('game_id', gameId)
        .is('held_by_player_id', null)
        .order('deck_position', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (topCard) {
        await sb.from('cards').update({ held_by_player_id: myGP.id }).eq('id', topCard.id)
        await sb.from('game_players').update({ card_count: myCards.length + 1 })
          .eq('game_id', gameId).eq('id', myGP.id)
        setMyCards(prev => [...prev, { id: topCard.id, territoryId: topCard.territory_id, cardType: topCard.card_type }])
      }
    }

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
    setSelectedCards([])
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
    // Fetch fresh state to avoid stale data
    const { data: freshTs } = await sb.from('territory_states')
      .select('territory_id, owner_player_id, armies').eq('game_id', gameId)
    if (!freshTs) return
    const fresh = new Map(freshTs.map((r: any) => [r.territory_id, { territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies as number }]))

    // ── Deploy: place armies on weakest border territories ──
    const deployCount = calcDeployArmies(botId, mapTerritories, bonusGroups, fresh as any)
    const botTerritories = freshTs.filter(t => t.owner_player_id === botId)
    const borders = botTerritories.filter(ts => {
      const t = mapTerritories.find(mt => mt.id === ts.territory_id)
      return t?.adjacent_ids?.some(aid => fresh.get(aid)?.ownerId !== botId)
    })
    // Sort borders by weakest first (most in need of reinforcement)
    const deployTargets = (borders.length > 0 ? borders : botTerritories)
      .sort((a, b) => a.armies - b.armies)

    for (let i = 0; i < deployCount; i++) {
      // Weight toward weaker territories
      const pick = deployTargets[i % deployTargets.length]
      const current = fresh.get(pick.territory_id)!
      const newArmies = current.armies + 1
      await sb.from('territory_states').update({ armies: newArmies })
        .eq('game_id', gameId).eq('territory_id', pick.territory_id)
      current.armies = newArmies
      pick.armies = newArmies

      await sb.from('game_events').insert({
        game_id: gameId, game_player_id: botId, event_type: 'deploy', turn_number: game!.turnNumber,
        event_data: { territory_id: pick.territory_id, armies_placed: 1 },
      })
      await new Promise(r => setTimeout(r, 200))
    }

    // ── Attack: up to 8 attacks, prefer high advantage ──
    let conqueredAny = false
    for (let atk = 0; atk < 8; atk++) {
      // Re-read fresh state each attack
      const { data: atkTs } = await sb.from('territory_states')
        .select('territory_id, owner_player_id, armies').eq('game_id', gameId)
      if (!atkTs) break
      const atkMap = new Map(atkTs.map((r: any) => [r.territory_id, { territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies as number }]))

      // Find best attack: greatest army advantage
      let bestSrc: string | null = null, bestTgt: string | null = null, bestAdv = 0
      for (const ts of atkTs) {
        if (ts.owner_player_id !== botId || ts.armies < 3) continue
        const terr = mapTerritories.find(t => t.id === ts.territory_id)
        for (const adj of terr?.adjacent_ids ?? []) {
          const enemy = atkMap.get(adj)
          if (enemy && enemy.ownerId !== botId) {
            const advantage = ts.armies - enemy.armies
            if (advantage > bestAdv) { bestAdv = advantage; bestSrc = ts.territory_id; bestTgt = adj }
          }
        }
      }
      // Only attack with advantage >= 1
      if (!bestSrc || !bestTgt || bestAdv < 1) break

      const srcArmies = atkMap.get(bestSrc)!.armies
      const tgtArmies = atkMap.get(bestTgt)!.armies
      const atkCount = Math.min(3, srcArmies - 1)
      const defCount = Math.min(2, tgtArmies)

      const { data: dice } = await sb.rpc('roll_dice', { attack_count: atkCount, defend_count: defCount })
      if (!dice) break

      const newSrc = srcArmies - dice.attacker_losses
      const newTgt = tgtArmies - dice.defender_losses

      if (newTgt <= 0) {
        // Territory conquered
        conqueredAny = true
        const move = Math.min(atkCount, newSrc - 1)
        await Promise.all([
          sb.from('territory_states').update({ armies: newSrc - move }).eq('game_id', gameId).eq('territory_id', bestSrc),
          sb.from('territory_states').update({ owner_player_id: botId, armies: Math.max(1, move) }).eq('game_id', gameId).eq('territory_id', bestTgt),
        ])
        // Check elimination
        const defenderId = atkMap.get(bestTgt)!.ownerId
        const defLeft = atkTs.filter(t => t.owner_player_id === defenderId && t.territory_id !== bestTgt).length
        if (defLeft === 0 && defenderId) {
          await sb.from('game_players').update({ is_eliminated: true, eliminated_at: new Date().toISOString() }).eq('game_id', gameId).eq('id', defenderId)
        }
        // Check win
        const botOwns = atkTs.filter(t => t.owner_player_id === botId).length + 1
        if (botOwns >= mapTerritories.length) {
          const botPlayer = players.find(p => p.id === botId)
          await sb.from('games').update({ status: 'finished', winner_id: botPlayer?.playerId ?? null }).eq('id', gameId)
          await sb.from('game_events').insert({
            game_id: gameId, game_player_id: botId, event_type: 'win', turn_number: game!.turnNumber,
            event_data: { winner_player_id: botPlayer?.playerId ?? null },
          })
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

    // ── Fortify: move armies from safest interior to weakest border ──
    const { data: fortTs } = await sb.from('territory_states')
      .select('territory_id, owner_player_id, armies').eq('game_id', gameId)
    if (fortTs) {
      const fortMap = new Map(fortTs.map((r: any) => [r.territory_id, { territoryId: r.territory_id, ownerId: r.owner_player_id, armies: r.armies as number }]))

      // Interior territories (all neighbors are owned by bot)
      const interior = fortTs
        .filter(ts => ts.owner_player_id === botId && ts.armies > 1)
        .filter(ts => {
          const t = mapTerritories.find(mt => mt.id === ts.territory_id)
          return t?.adjacent_ids?.every(aid => fortMap.get(aid)?.ownerId === botId)
        })
        .sort((a, b) => b.armies - a.armies)

      // Border territories (weakest first)
      const borderTs = fortTs
        .filter(ts => ts.owner_player_id === botId)
        .filter(ts => {
          const t = mapTerritories.find(mt => mt.id === ts.territory_id)
          return t?.adjacent_ids?.some(aid => fortMap.get(aid)?.ownerId !== botId)
        })
        .sort((a, b) => a.armies - b.armies)

      if (interior.length > 0 && borderTs.length > 0) {
        const src = interior[0]
        const tgt = borderTs[0]
        // Check BFS connectivity
        if (areConnected(src.territory_id, tgt.territory_id, mapTerritories, botId, fortMap as any)) {
          const moveAmt = src.armies - 1
          if (moveAmt > 0) {
            await Promise.all([
              sb.from('territory_states').update({ armies: 1 }).eq('game_id', gameId).eq('territory_id', src.territory_id),
              sb.from('territory_states').update({ armies: tgt.armies + moveAmt }).eq('game_id', gameId).eq('territory_id', tgt.territory_id),
            ])
            await sb.from('game_events').insert({
              game_id: gameId, game_player_id: botId, event_type: 'fortify', turn_number: game!.turnNumber,
              event_data: { from: src.territory_id, to: tgt.territory_id, armies_moved: moveAmt },
            })
          }
        }
      }
    }

    // ── Draw card if conquered a territory this turn ──
    if (conqueredAny) {
      const { data: topCard } = await sb.from('cards')
        .select('id')
        .eq('game_id', gameId)
        .is('held_by_player_id', null)
        .order('deck_position', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (topCard) {
        await sb.from('cards').update({ held_by_player_id: botId }).eq('id', topCard.id)
        await sb.from('game_players').update({ card_count: (players.find(p => p.id === botId)?.cardCount ?? 0) + 1 })
          .eq('game_id', gameId).eq('id', botId)
      }
    }

    // ── End bot turn ──
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
            <GameGlobeMap territories={mapTerritories} tsMap={tsMap} playerMap={playerMap}
              attackFrom={null} attackTo={null} fortifyFrom={null} fortifyTo={null}
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
          <GameGlobeMap
            territories={mapTerritories} tsMap={tsMap} playerMap={playerMap}
            attackFrom={attackFrom} attackTo={attackTo}
            fortifyFrom={fortifyFrom} fortifyTo={fortifyTo}
            isMyTurn={isMyTurn}
            onClick={handleTerritoryClick}
          />
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        <div className="w-72 flex flex-col border-l border-crusader-gold/10 overflow-hidden" style={{ background: 'rgba(6,5,3,0.92)' }}>

          {/* Action error */}
          {actionError && (
            <div className="shrink-0 px-4 py-2 bg-red-900/20 border-b border-red-400/20">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-cinzel text-red-400">{actionError}</p>
                <button onClick={() => setActionError(null)} className="text-red-400/50 hover:text-red-400 text-xs ml-2">&times;</button>
              </div>
            </div>
          )}

          {/* Action panel */}
          {isMyTurn && (
            <div className="shrink-0 p-4 border-b border-crusader-gold/10 space-y-3">
              {phase === 'deploy' && (
                <div className="text-center space-y-3">
                  <div>
                    <p className="font-cinzel text-xs text-crusader-gold/60 mb-1">Click your territories to deploy</p>
                    <p className="font-cinzel text-2xl font-bold text-crusader-gold">{deployLeft}</p>
                    <p className="font-cinzel text-[10px] text-crusader-gold/35 tracking-widest">ARMIES REMAINING</p>
                  </div>
                  {myCards.length > 0 && (
                    <button
                      onClick={() => setShowCards(!showCards)}
                      className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded border border-crusader-gold/20 hover:border-crusader-gold/40 transition-colors"
                    >
                      <Layers size={12} className="text-crusader-gold/60" />
                      <span className="text-[10px] font-cinzel text-crusader-gold/60">
                        Cards ({myCards.length})
                      </span>
                    </button>
                  )}
                  {showCards && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {myCards.map(card => {
                          const isSelected = selectedCards.includes(card.id)
                          const typeIcon = card.cardType === 'infantry' ? '♟' : card.cardType === 'cavalry' ? '♞' : card.cardType === 'artillery' ? '♜' : '★'
                          const typeColor = card.cardType === 'infantry' ? 'border-green-400/40 bg-green-400/10' : card.cardType === 'cavalry' ? 'border-blue-400/40 bg-blue-400/10' : card.cardType === 'artillery' ? 'border-red-400/40 bg-red-400/10' : 'border-yellow-400/40 bg-yellow-400/10'
                          return (
                            <button
                              key={card.id}
                              onClick={() => toggleCardSelection(card.id)}
                              className={`w-12 h-16 rounded border-2 flex flex-col items-center justify-center gap-0.5 transition-all ${typeColor} ${
                                isSelected ? 'ring-2 ring-crusader-gold scale-105' : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              <span className="text-lg">{typeIcon}</span>
                              <span className="text-[7px] font-cinzel text-crusader-gold/50 uppercase leading-none">{card.cardType === 'wild' ? 'Wild' : card.cardType.slice(0, 3)}</span>
                            </button>
                          )
                        })}
                      </div>
                      {selectedCards.length === 3 && (
                        <Button
                          fullWidth size="sm"
                          onClick={tradeCards}
                          loading={actionLock}
                          disabled={!isValidCardSet(myCards.filter(c => selectedCards.includes(c.id)))}
                          className="!bg-crusader-gold/20 !border-crusader-gold/40 !text-crusader-gold"
                        >
                          {isValidCardSet(myCards.filter(c => selectedCards.includes(c.id)))
                            ? 'Trade Cards for Armies'
                            : 'Invalid Set'}
                        </Button>
                      )}
                      {selectedCards.length < 3 && (
                        <p className="text-[9px] font-cinzel text-crusader-gold/30 text-center">
                          Select 3 cards: three of a kind or one of each
                        </p>
                      )}
                    </div>
                  )}
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
