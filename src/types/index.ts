// ─── Player / Auth ────────────────────────────────────────────────────────────
export interface Player {
  id: string
  username: string
  avatar_url?: string
  default_color: string
  xp: number
  level: number
  elo: number
  games_played: number
  games_won: number
  games_lost: number
  created_at: string
  updated_at: string
}

export interface PlayerAchievement {
  id: string
  player_id: string
  achievement_id: string
  unlocked_at: string
  achievements: {
    id: string
    name: string
    description: string
    icon: string
    category: string
    xp_reward: number
  }
}

// ─── Battle Map ───────────────────────────────────────────────────────────────
export interface Territory {
  id: string
  name: string
  polygon: [number, number][]   // projected 2D coordinates
  seed: [number, number]        // center point
  adjacent_ids: string[]
  bonus_group?: string
  color?: string
}

export interface BonusGroup {
  id: string
  name: string
  territory_ids: string[]
  bonus_armies: number
}

export interface BattleMap {
  id: string
  name: string
  description?: string
  author_id: string
  author_name: string
  region_name: string           // e.g. "France", "South America"
  region_bounds: {              // lat/lon bounding box
    minLat: number; maxLat: number
    minLon: number; maxLon: number
  }
  country_iso_ids: number[]     // numeric ISO-3166 codes of selected countries
  territories: Territory[]
  bonus_groups: BonusGroup[]
  thumbnail_url?: string
  is_public: boolean
  play_count: number
  created_at: string
  updated_at: string
}

// ─── Game ─────────────────────────────────────────────────────────────────────
export type GameMode    = 'lightning' | 'slow_hour' | 'slow_day'
export type GameStatus  = 'waiting' | 'active' | 'finished'
export type PlayerColor = '#E74C3C' | '#3498DB' | '#2ECC71' | '#F39C12' | '#9B59B6' | '#1ABC9C'

export const PLAYER_COLORS: PlayerColor[] = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C',
]

export interface GamePlayer {
  id: string
  player_id: string
  username: string
  avatar_url?: string
  color: PlayerColor
  is_ai: boolean
  ai_difficulty?: 'easy' | 'medium' | 'hard'
  territories_held: string[]
  total_armies: number
  cards: number
  is_eliminated: boolean
  turn_order: number
}

export interface TerritoryState {
  territory_id: string
  owner_id: string | null
  armies: number
}

export interface Game {
  id: string
  map_id: string
  map: BattleMap
  name: string
  mode: GameMode
  status: GameStatus
  max_players: number
  current_players: number
  players: GamePlayer[]
  territory_states: TerritoryState[]
  current_turn_player_id: string
  turn_number: number
  turn_deadline?: string
  winner_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Map Creator State ────────────────────────────────────────────────────────
export interface MapCreatorState {
  step: 'select-region' | 'generate' | 'customize' | 'save'
  selectedCountryId?: string
  selectedCountryName?: string
  selectedCountryGeo?: GeoJSON.Feature
  territoryCount: number
  mapName: string
  mapDescription: string
  territories: Territory[]
  bonusGroups: BonusGroup[]
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
export interface LobbyGame extends Pick<Game, 'id' | 'name' | 'mode' | 'status' | 'max_players' | 'current_players' | 'created_at'> {
  map_name: string
  region_name: string
  map_thumbnail?: string
  creator_name: string
  has_ai: boolean
}
