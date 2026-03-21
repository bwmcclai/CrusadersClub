'use client'
import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TerritoryMap from '@/components/three/TerritoryMap'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { generateTerritories } from '@/lib/utils'
import type { Territory, TerritoryState, GamePlayer, PlayerColor } from '@/types'
import { PLAYER_COLORS } from '@/types'
import {
  Sword, Shield, RotateCcw, ChevronRight, Dices,
  Users, Clock, Zap, ArrowLeft, Trophy, X, Star,
} from 'lucide-react'

// ─── Mock game data ───────────────────────────────────────────────────────────
function buildMockGame() {
  // Generate a small demo map
  const demoRings: [number, number][][] = [[
    [-5, 42], [10, 42], [15, 47], [15, 55], [10, 58],
    [5, 58], [-2, 56], [-8, 52], [-10, 46], [-5, 42],
  ]]
  const { territories } = generateTerritories(demoRings, 12, 800, 600)

  const players: GamePlayer[] = [
    { id: 'gp1', player_id: 'p1', username: 'IronCrusader', color: '#E74C3C', is_ai: false, territories_held: [], total_armies: 18, cards: 2, is_eliminated: false, turn_order: 0 },
    { id: 'gp2', player_id: 'p2', username: 'SteelFist',    color: '#3498DB', is_ai: false, territories_held: [], total_armies: 15, cards: 1, is_eliminated: false, turn_order: 1 },
    { id: 'gp3', player_id: 'p3', username: 'AI Baron',     color: '#2ECC71', is_ai: true,  territories_held: [], total_armies: 12, cards: 0, is_eliminated: false, turn_order: 2, ai_difficulty: 'medium' },
    { id: 'gp4', player_id: 'p4', username: 'Valhalla',     color: '#F39C12', is_ai: false, territories_held: [], total_armies: 10, cards: 3, is_eliminated: false, turn_order: 3 },
  ]

  // Distribute territories
  const states: TerritoryState[] = territories.map((t, i) => ({
    territory_id: t.id,
    owner_id:     players[i % players.length].player_id,
    armies:       Math.floor(Math.random() * 6) + 1,
  }))

  players.forEach((p) => {
    p.territories_held = states.filter((s) => s.owner_id === p.player_id).map((s) => s.territory_id)
  })

  return { territories, states, players }
}

const { territories: DEMO_TERRITORIES, states: DEMO_STATES, players: DEMO_PLAYERS } = buildMockGame()

// ─── Dice Component ───────────────────────────────────────────────────────────
function DiceRoll({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="flex gap-2">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shadow-lg border-2"
          style={{ borderColor: color + '88', background: color + '22', color }}
        >
          {v}
        </div>
      ))}
    </div>
  )
}

// ─── Battle Modal ─────────────────────────────────────────────────────────────
interface BattleResult {
  attackerDice: number[]
  defenderDice: number[]
  attackerLoss:  number
  defenderLoss:  number
  conquered:    boolean
}

function BattleModal({
  attacker, defender, open, onClose,
}: {
  attacker:  { name: string; armies: number; color: string }
  defender:  { name: string; armies: number; color: string }
  open:      boolean
  onClose:   (result: BattleResult) => void
}) {
  const [result, setResult] = useState<BattleResult | null>(null)
  const [rolling, setRolling] = useState(false)

  function rollDice() {
    setRolling(true)
    setTimeout(() => {
      const aDice = Array.from({ length: Math.min(3, attacker.armies - 1) }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a)
      const dDice = Array.from({ length: Math.min(2, defender.armies) },     () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a)
      let aLoss = 0, dLoss = 0
      const pairs = Math.min(aDice.length, dDice.length)
      for (let i = 0; i < pairs; i++) {
        if (aDice[i] > dDice[i]) dLoss++
        else aLoss++
      }
      const conquered = dLoss >= defender.armies
      setResult({ attackerDice: aDice, defenderDice: dDice, attackerLoss: aLoss, defenderLoss: dLoss, conquered })
      setRolling(false)
    }, 800)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md glass rounded-2xl border border-crusader-gold/20 p-6 animate-slide-up">
        <h3 className="font-cinzel text-xl font-bold text-crusader-gold text-center mb-6">⚔️ Battle!</h3>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center">
            <div className="text-sm font-cinzel text-crusader-gold/60 mb-1">Attacker</div>
            <div className="font-cinzel font-bold text-lg" style={{ color: attacker.color }}>{attacker.name}</div>
            <div className="text-2xl font-bold text-white mt-1">{attacker.armies} 🏹</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-cinzel text-crusader-gold/60 mb-1">Defender</div>
            <div className="font-cinzel font-bold text-lg" style={{ color: defender.color }}>{defender.name}</div>
            <div className="text-2xl font-bold text-white mt-1">{defender.armies} 🛡</div>
          </div>
        </div>

        {result ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <DiceRoll values={result.attackerDice} color={attacker.color} />
                {result.attackerLoss > 0 && (
                  <p className="text-xs text-red-400 mt-2">-{result.attackerLoss} army</p>
                )}
              </div>
              <div className="text-center">
                <DiceRoll values={result.defenderDice} color={defender.color} />
                {result.defenderLoss > 0 && (
                  <p className="text-xs text-red-400 mt-2">-{result.defenderLoss} army</p>
                )}
              </div>
            </div>

            {result.conquered && (
              <div className="text-center py-3 mb-4 rounded-xl bg-crusader-gold/20 border border-crusader-gold/40">
                <Trophy size={24} className="text-crusader-gold mx-auto mb-1" />
                <p className="font-cinzel font-bold text-crusader-gold">Territory Conquered!</p>
              </div>
            )}

            <Button fullWidth onClick={() => { setResult(null); onClose(result) }}>
              Continue
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Button fullWidth icon={<Dices size={18} />} onClick={rollDice} loading={rolling}>
              Roll Dice!
            </Button>
            <Button fullWidth variant="outline" onClick={() => onClose({ attackerDice: [], defenderDice: [], attackerLoss: 0, defenderLoss: 0, conquered: false })}>
              Retreat
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type TurnPhase = 'deploy' | 'attack' | 'fortify'

export default function GamePage() {
  const [territories, setTerritories] = useState<Territory[]>(DEMO_TERRITORIES)
  const [states, setStates]           = useState<TerritoryState[]>(DEMO_STATES)
  const [players]                     = useState<GamePlayer[]>(DEMO_PLAYERS)
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0)
  const [phase, setPhase]             = useState<TurnPhase>('deploy')
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [armiesToDeploy, setArmiesToDeploy] = useState(3)
  const [battleModal, setBattleModal] = useState<{ attacker: string; defender: string } | null>(null)
  const [log, setLog]                 = useState<string[]>(['Game started. IronCrusader\'s turn.'])

  const currentPlayer = players[currentPlayerIdx]
  const myPid = 'p1' // pretend we are p1

  const selectedState = states.find((s) => s.territory_id === selectedId)
  const selectedTerritory = territories.find((t) => t.id === selectedId)

  const attackableIds = useMemo(() => {
    if (phase !== 'attack' || !selectedId || selectedState?.owner_id !== myPid) return []
    const sel = territories.find((t) => t.id === selectedId)
    if (!sel || (selectedState?.armies ?? 0) < 2) return []
    return sel.adjacent_ids.filter((aid) => {
      const adj = states.find((s) => s.territory_id === aid)
      return adj && adj.owner_id !== myPid
    })
  }, [phase, selectedId, selectedState, territories, states, myPid])

  function addLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 20))
  }

  function handleTerritoryClick(t: Territory) {
    const s = states.find((st) => st.territory_id === t.id)
    if (!s) return

    if (phase === 'deploy') {
      if (s.owner_id !== myPid || armiesToDeploy <= 0) return
      setStates((prev) => prev.map((st) => st.territory_id === t.id ? { ...st, armies: st.armies + 1 } : st))
      setArmiesToDeploy((n) => n - 1)
      addLog(`Deployed 1 army to ${t.name}`)
      return
    }

    if (phase === 'attack') {
      if (!selectedId && s.owner_id === myPid && s.armies >= 2) {
        setSelectedId(t.id)
        return
      }
      if (selectedId && attackableIds.includes(t.id)) {
        const attackerState = states.find((st) => st.territory_id === selectedId)!
        setBattleModal({ attacker: selectedId, defender: t.id })
        return
      }
      if (s.owner_id === myPid) {
        setSelectedId(t.id)
      } else {
        setSelectedId(null)
      }
      return
    }

    if (phase === 'fortify') {
      setSelectedId((prev) => prev === t.id ? null : t.id)
    }
  }

  function handleBattleClose(result: {
    attackerDice: number[]; defenderDice: number[]
    attackerLoss: number; defenderLoss: number; conquered: boolean
  }) {
    if (!battleModal) return
    const { attacker, defender } = battleModal

    setStates((prev) => prev.map((s) => {
      if (s.territory_id === attacker) return { ...s, armies: Math.max(1, s.armies - result.attackerLoss) }
      if (s.territory_id === defender) {
        if (result.conquered) {
          const atkState = prev.find((ps) => ps.territory_id === attacker)
          addLog(`🎉 ${currentPlayer.username} conquered ${territories.find((t) => t.id === defender)?.name}!`)
          return { ...s, owner_id: myPid, armies: Math.max(1, (atkState?.armies ?? 2) - 1) }
        }
        return { ...s, armies: Math.max(1, s.armies - result.defenderLoss) }
      }
      return s
    }))

    if (!result.conquered) {
      addLog(`Battle: ${result.attackerLoss} attacker / ${result.defenderLoss} defender losses`)
    }
    setBattleModal(null)
    setSelectedId(null)
  }

  function nextPhase() {
    if (phase === 'deploy') { setPhase('attack'); addLog('Attack phase. Select a territory to attack from.') }
    else if (phase === 'attack') { setPhase('fortify'); setSelectedId(null); addLog('Fortify phase.') }
    else {
      // End turn
      const next = (currentPlayerIdx + 1) % players.length
      setCurrentPlayerIdx(next)
      setPhase('deploy')
      setArmiesToDeploy(3)
      setSelectedId(null)
      addLog(`${players[next].username}'s turn begins.`)
    }
  }

  const battleAttackerState = battleModal ? states.find((s) => s.territory_id === battleModal.attacker) : null
  const battleDefenderState = battleModal ? states.find((s) => s.territory_id === battleModal.defender) : null
  const battleAttackerT     = battleModal ? territories.find((t) => t.id === battleModal.attacker) : null
  const battleDefenderT     = battleModal ? territories.find((t) => t.id === battleModal.defender) : null

  return (
    <div className="h-screen bg-crusader-void flex flex-col overflow-hidden">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-14 glass-dark border-b border-crusader-gold/10 flex items-center px-4 gap-4">
        <Link href="/lobby">
          <button className="p-1.5 rounded-lg text-crusader-gold/40 hover:text-crusader-gold hover:bg-crusader-gold/10 transition-colors">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <span className="font-cinzel text-sm font-bold text-crusader-gold tracking-widest">WESTERN FRONT</span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-crusader-gold/10 border border-crusader-gold/20">
          <Zap size={12} className="text-crusader-gold" />
          <span className="text-xs text-crusader-gold font-medium">Lightning</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-xs text-crusader-gold/40">
            <Clock size={12} />
            <span>0:47</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel: Players ───────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-56 border-r border-crusader-gold/10 bg-crusader-dark/60 p-3 gap-2 overflow-y-auto">
          <p className="text-xs font-cinzel text-crusader-gold/40 tracking-widest uppercase px-1 mb-1">Players</p>
          {players.map((p, i) => {
            const tCount = states.filter((s) => s.owner_id === p.player_id).length
            const armies = states.filter((s) => s.owner_id === p.player_id).reduce((sum, s) => sum + s.armies, 0)
            const isActive = i === currentPlayerIdx
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                  isActive ? 'border-crusader-gold/40 bg-crusader-gold/10' : 'border-transparent hover:border-crusader-gold/10'
                }`}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color, boxShadow: isActive ? `0 0 8px ${p.color}` : 'none' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-crusader-gold-light/80 truncate">{p.username}</p>
                    {p.is_ai && <span className="text-[10px] text-crusader-gold/30">AI</span>}
                  </div>
                  <p className="text-[10px] text-crusader-gold/30 mt-0.5">{tCount}t · {armies}a</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-crusader-gold animate-pulse flex-shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* ── Map ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 relative bg-crusader-dark/30 overflow-hidden">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <TerritoryMap
            territories={territories}
            territoryStates={states}
            players={players}
            selectedId={selectedId}
            attackableIds={attackableIds}
            onTerritoryClick={handleTerritoryClick}
            className="absolute inset-0 p-6"
          />

          {/* Phase instruction banner */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="glass px-5 py-2 rounded-full border border-crusader-gold/20 text-center">
              <p className="text-xs font-cinzel text-crusader-gold/80 tracking-widest uppercase">
                {phase === 'deploy'  && `Deploy Phase — ${armiesToDeploy} armies remaining`}
                {phase === 'attack'  && (selectedId ? 'Click an enemy territory to attack' : 'Select your territory to attack from')}
                {phase === 'fortify' && 'Select territories to fortify (or skip)'}
              </p>
            </div>
          </div>

          {/* Selected territory info */}
          {selectedTerritory && selectedState && phase === 'attack' && (
            <div className="absolute bottom-4 left-4 glass rounded-xl p-3 border border-crusader-gold/20 text-sm">
              <p className="font-cinzel text-crusader-gold font-semibold">{selectedTerritory.name}</p>
              <p className="text-xs text-crusader-gold/50 mt-0.5">{selectedState.armies} armies · Click enemy to attack</p>
            </div>
          )}
        </div>

        {/* ── Right panel: Controls + Log ──────────────────────────────────── */}
        <div className="w-64 flex flex-col border-l border-crusader-gold/10 bg-crusader-dark/60">
          {/* Turn info */}
          <div className="p-4 border-b border-crusader-gold/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentPlayer.color }} />
              <span className="font-cinzel text-sm font-bold text-crusader-gold">{currentPlayer.username}</span>
              {currentPlayer.is_ai && <span className="text-[10px] text-crusader-gold/40 bg-crusader-gold/10 px-1.5 py-0.5 rounded">AI</span>}
            </div>

            {/* Phase tabs */}
            <div className="flex rounded-lg overflow-hidden border border-crusader-gold/10 mt-3">
              {(['deploy', 'attack', 'fortify'] as TurnPhase[]).map((p) => (
                <div
                  key={p}
                  className={`flex-1 text-center py-1.5 text-[10px] font-cinzel tracking-wide uppercase transition-colors ${
                    phase === p ? 'bg-crusader-gold/20 text-crusader-gold' : 'text-crusader-gold/20'
                  }`}
                >
                  {p === 'deploy' ? '⚔️' : p === 'attack' ? '🗡️' : '🏰'}
                </div>
              ))}
            </div>

            {phase === 'deploy' && (
              <div className="mt-3 text-center">
                <span className="font-cinzel text-3xl font-bold text-crusader-gold">{armiesToDeploy}</span>
                <p className="text-xs text-crusader-gold/40">armies to place</p>
              </div>
            )}
          </div>

          {/* Phase action button */}
          <div className="p-4 border-b border-crusader-gold/10">
            <Button
              fullWidth
              variant={phase === 'fortify' ? 'gold' : 'outline'}
              onClick={nextPhase}
              size="md"
              disabled={phase === 'deploy' && armiesToDeploy > 0}
            >
              {phase === 'deploy'  ? 'Start Attacking' :
               phase === 'attack'  ? 'End Attacks'     :
                                     'End Turn'}
              <ChevronRight size={14} />
            </Button>
          </div>

          {/* Battle log */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] font-cinzel text-crusader-gold/40 tracking-widest uppercase mb-2">Battle Log</p>
            <div className="space-y-1.5">
              {log.map((entry, i) => (
                <p key={i} className={`text-xs leading-relaxed ${i === 0 ? 'text-crusader-gold-light/70' : 'text-crusader-gold/30'}`}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Battle modal */}
      {battleModal && battleAttackerState && battleDefenderState && battleAttackerT && battleDefenderT && (
        <BattleModal
          open
          attacker={{ name: battleAttackerT.name, armies: battleAttackerState.armies, color: currentPlayer.color }}
          defender={{
            name:   battleDefenderT.name,
            armies: battleDefenderState.armies,
            color:  players.find((p) => p.player_id === battleDefenderState.owner_id)?.color ?? '#888',
          }}
          onClose={handleBattleClose}
        />
      )}
    </div>
  )
}
