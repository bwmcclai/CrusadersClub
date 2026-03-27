import { getSupabaseClient } from './supabase'
import type { GameMode, Territory } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#1F8EAD']
const BOT_NAMES = ['Sir Botsworth', 'Lady Algorithm', 'Baron von Circuit', 'Duchess Neural', 'Count Processor', 'Squire Byte', 'Dame Dataflow']
const ARMIES_BY_PLAYERS: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20, 7: 18, 8: 15 }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Create Game ─────────────────────────────────────────────────────────────

export interface CreateGameOpts {
  name: string
  mapId: string
  mode: GameMode
  maxPlayers: number
  aiCount: number
  creatorId: string
  creatorName: string
  creatorAvatar?: string
}

export async function createGame(opts: CreateGameOpts): Promise<string> {
  const sb = getSupabaseClient()

  const { data: game, error } = await sb.from('games').insert({
    name: opts.name,
    map_id: opts.mapId,
    mode: opts.mode,
    max_players: opts.maxPlayers,
    created_by: opts.creatorId,
  }).select('id').single()

  if (error || !game) throw error ?? new Error('Failed to create game')
  const gameId = game.id

  // Add creator as player 0
  const { error: pErr } = await sb.from('game_players').insert({
    game_id: gameId,
    player_id: opts.creatorId,
    username: opts.creatorName,
    avatar_url: opts.creatorAvatar ?? null,
    color: COLORS[0],
    is_ai: false,
    turn_order: 0,
  })
  if (pErr) throw pErr

  // Add AI bots
  for (let i = 0; i < opts.aiCount; i++) {
    const { error: bErr } = await sb.from('game_players').insert({
      game_id: gameId,
      player_id: null,
      username: BOT_NAMES[i % BOT_NAMES.length],
      color: COLORS[(1 + i) % COLORS.length],
      is_ai: true,
      ai_difficulty: 'medium',
      turn_order: 1 + i,
    })
    if (bErr) throw bErr
  }

  // Auto-start if full (creator + bots >= max)
  if (1 + opts.aiCount >= opts.maxPlayers) {
    await initializeGame(gameId)
  }

  return gameId
}

// ─── Join Game ───────────────────────────────────────────────────────────────

export async function joinGame(
  gameId: string,
  player: { id: string; username: string; avatar_url?: string },
) {
  const sb = getSupabaseClient()

  const { data: game } = await sb.from('games')
    .select('status, max_players, current_players')
    .eq('id', gameId).single()
  if (!game) throw new Error('Game not found')
  if (game.status !== 'waiting') return
  if (game.current_players >= game.max_players) throw new Error('Game is full')

  // Already joined?
  const { data: existing } = await sb.from('game_players')
    .select('id').eq('game_id', gameId).eq('player_id', player.id).maybeSingle()
  if (existing) return

  // Determine color + turn order
  const { data: ps } = await sb.from('game_players')
    .select('turn_order, color').eq('game_id', gameId)
  const usedColors = new Set(ps?.map(p => p.color) ?? [])
  const nextColor = COLORS.find(c => !usedColors.has(c)) ?? COLORS[0]

  await sb.from('game_players').insert({
    game_id: gameId,
    player_id: player.id,
    username: player.username,
    avatar_url: player.avatar_url ?? null,
    color: nextColor,
    is_ai: false,
    turn_order: ps?.length ?? 0,
  })

  // Re-check if now full (trigger updates current_players)
  const { data: updated } = await sb.from('games')
    .select('current_players, max_players').eq('id', gameId).single()
  if (updated && updated.current_players >= updated.max_players) {
    await initializeGame(gameId)
  }
}

// ─── Initialize Game (territory assignment, cards, start) ────────────────────

export async function initializeGame(gameId: string) {
  const sb = getSupabaseClient()

  const { data: game } = await sb.from('games')
    .select('id, map_id, mode').eq('id', gameId).single()
  if (!game) throw new Error('Game not found')

  const { data: map } = await sb.from('battle_maps')
    .select('territories').eq('id', game.map_id).single()
  if (!map) throw new Error('Map not found')

  const territories = map.territories as Territory[]
  const { data: gamePlayers } = await sb.from('game_players')
    .select('id, turn_order').eq('game_id', gameId).order('turn_order')
  if (!gamePlayers || gamePlayers.length < 2) throw new Error('Not enough players')

  const n = gamePlayers.length
  const baseArmies = ARMIES_BY_PLAYERS[n] ?? Math.max(15, 50 - 5 * n)
  const perPlayer = Math.max(baseArmies, Math.ceil(territories.length / n) + 5)

  // Assign territories round-robin (shuffled)
  const shuffled = shuffle(territories)
  const states: { game_id: string; territory_id: string; owner_player_id: string; armies: number }[] = []
  const placed: Record<string, number> = {}
  gamePlayers.forEach(p => { placed[p.id] = 0 })

  shuffled.forEach((t, i) => {
    const p = gamePlayers[i % n]
    states.push({ game_id: gameId, territory_id: t.id, owner_player_id: p.id, armies: 1 })
    placed[p.id]++
  })

  // Distribute remaining armies randomly to owned territories
  for (const p of gamePlayers) {
    const remaining = perPlayer - placed[p.id]
    const owned = states.filter(s => s.owner_player_id === p.id)
    for (let i = 0; i < remaining; i++) {
      owned[Math.floor(Math.random() * owned.length)].armies++
    }
  }

  // Insert territory states
  const BATCH = 100
  for (let i = 0; i < states.length; i += BATCH) {
    const { error } = await sb.from('territory_states').insert(states.slice(i, i + BATCH))
    if (error) throw error
  }

  // Create shuffled card deck
  const cardTypes = ['infantry', 'cavalry', 'artillery'] as const
  const cards: { game_id: string; territory_id: string; card_type: string; held_by_player_id: null; deck_position: number }[] =
    territories.map((t, i) => ({
      game_id: gameId, territory_id: t.id,
      card_type: cardTypes[i % 3],
      held_by_player_id: null, deck_position: i,
    }))
  cards.push({ game_id: gameId, territory_id: 'wild-1', card_type: 'wild', held_by_player_id: null, deck_position: territories.length })
  cards.push({ game_id: gameId, territory_id: 'wild-2', card_type: 'wild', held_by_player_id: null, deck_position: territories.length + 1 })
  const positions = shuffle(cards.map((_, i) => i))
  cards.forEach((c, i) => { c.deck_position = positions[i] })

  for (let i = 0; i < cards.length; i += BATCH) {
    await sb.from('cards').insert(cards.slice(i, i + BATCH))
  }

  // Activate the game
  const deadlineMs = game.mode === 'lightning' ? 60_000 : game.mode === 'slow_hour' ? 3_600_000 : 86_400_000
  await sb.from('games').update({
    status: 'active',
    current_turn_player_id: gamePlayers[0].id,
    turn_number: 1,
    turn_deadline: new Date(Date.now() + deadlineMs).toISOString(),
  }).eq('id', gameId)

  await sb.from('game_events').insert({
    game_id: gameId, event_type: 'start', turn_number: 1,
    event_data: { player_count: n, territory_count: territories.length },
  })
}
