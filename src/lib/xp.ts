// ─── Level / XP system ────────────────────────────────────────────────────────

export const MAX_LEVEL = 50

export interface LevelTier {
  min: number
  max: number
  title: string
  color: string         // hex for inline styles
  ringClass: string     // tailwind border color class
  badgeClass: string    // tailwind bg + text classes for badges
}

export const LEVEL_TIERS: LevelTier[] = [
  { min: 1,  max: 4,  title: 'Private',        color: '#8B9099', ringClass: 'border-gray-500',    badgeClass: 'bg-gray-700 text-gray-300'          },
  { min: 5,  max: 9,  title: 'Corporal',        color: '#A8B0BC', ringClass: 'border-gray-400',    badgeClass: 'bg-gray-600 text-gray-200'          },
  { min: 10, max: 14, title: 'Sergeant',         color: '#C9A84C', ringClass: 'border-yellow-600',  badgeClass: 'bg-yellow-900/50 text-yellow-400'   },
  { min: 15, max: 19, title: 'Lieutenant',       color: '#E8D090', ringClass: 'border-yellow-400',  badgeClass: 'bg-yellow-800/50 text-yellow-300'   },
  { min: 20, max: 24, title: 'Captain',          color: '#4AAFD4', ringClass: 'border-blue-400',    badgeClass: 'bg-blue-900/50 text-blue-300'       },
  { min: 25, max: 29, title: 'Major',            color: '#9B59B6', ringClass: 'border-purple-500',  badgeClass: 'bg-purple-900/50 text-purple-300'   },
  { min: 30, max: 34, title: 'Colonel',          color: '#E74C3C', ringClass: 'border-red-500',     badgeClass: 'bg-red-900/50 text-red-300'         },
  { min: 35, max: 39, title: 'Brigadier',        color: '#F39C12', ringClass: 'border-orange-400',  badgeClass: 'bg-orange-900/50 text-orange-300'   },
  { min: 40, max: 44, title: 'General',          color: '#2ECC71', ringClass: 'border-green-400',   badgeClass: 'bg-green-900/50 text-green-300'     },
  { min: 45, max: 49, title: 'Field Marshal',    color: '#C9A84C', ringClass: 'border-yellow-500',  badgeClass: 'bg-yellow-900/60 text-yellow-400'   },
  { min: 50, max: 50, title: 'Supreme Crusader', color: '#FFD700', ringClass: 'border-yellow-300',  badgeClass: 'bg-yellow-700/50 text-yellow-200'   },
]

export function getTierForLevel(level: number): LevelTier {
  return LEVEL_TIERS.find((t) => level >= t.min && level <= t.max) ?? LEVEL_TIERS[0]
}

/** XP needed to advance from `level` to `level + 1` */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0
  return 100 + (level - 1) * 50
}

/** Cumulative XP needed to reach a given level from level 1 */
export function totalXpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += xpToNextLevel(l)
  return total
}

export interface LevelProgress {
  level: number
  currentLevelXp: number  // XP earned within current level
  nextLevelXp: number     // XP needed to complete current level
  progress: number        // 0–100 percent
  totalXp: number
}

/** Decompose total XP into level + progress within that level */
export function computeLevelProgress(totalXp: number): LevelProgress {
  let xp    = totalXp
  let level = 1

  while (level < MAX_LEVEL) {
    const needed = xpToNextLevel(level)
    if (xp < needed) break
    xp -= needed
    level++
  }

  const nextLevelXp = xpToNextLevel(level)
  return {
    level,
    currentLevelXp: xp,
    nextLevelXp,
    progress: level >= MAX_LEVEL ? 100 : Math.round((xp / nextLevelXp) * 100),
    totalXp,
  }
}

// ─── Level unlock milestones ──────────────────────────────────────────────────

export type UnlockType = 'title' | 'feature' | 'cosmetic' | 'frame'

export interface LevelUnlock {
  level: number
  title: string
  description: string
  icon: string
  type: UnlockType
}

export const LEVEL_UNLOCKS: LevelUnlock[] = [
  { level: 1,  icon: '⚔️', type: 'title',    title: 'Joined the Crusade',       description: 'Welcome to the battlefield, Commander.' },
  { level: 5,  icon: '🖼️', type: 'feature',  title: 'Custom Avatar',            description: 'Upload your own avatar image.' },
  { level: 10, icon: '🥈', type: 'title',    title: 'Sergeant Rank',            description: 'Earn the Sergeant title + silver profile ring.' },
  { level: 15, icon: '🥇', type: 'title',    title: 'Lieutenant Rank',          description: 'Lieutenant title + gold nameplate.' },
  { level: 20, icon: '🤝', type: 'feature',  title: 'Team Game Modes',          description: 'Join doubles and triples team game modes.' },
  { level: 25, icon: '🌟', type: 'frame',    title: 'Major Rank + Gold Frame',  description: 'Gold profile frame and Major title.' },
  { level: 30, icon: '🗺️', type: 'feature',  title: 'Premium Map Templates',    description: 'Exclusive map templates in the Map Creator.' },
  { level: 35, icon: '✨', type: 'cosmetic', title: 'Animated Profile Border',  description: 'Your profile ring gains an animated glow.' },
  { level: 40, icon: '🎖️', type: 'feature',  title: 'General Rank',             description: 'Priority matchmaking queue access.' },
  { level: 45, icon: '💎', type: 'frame',    title: 'Field Marshal + Diamond',  description: 'Diamond-tier profile frame.' },
  { level: 50, icon: '👑', type: 'cosmetic', title: 'Supreme Crusader',         description: 'Animated crown, unique title, maximum glory.' },
]

// ─── Achievement definitions (matches DB seed) ───────────────────────────────

export type AchievementCategory = 'combat' | 'creator' | 'explorer' | 'legend'

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  xp_reward: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood',     name: 'First Blood',       description: 'Win your first battle.',            icon: '⚔️', category: 'combat',   xp_reward: 50   },
  { id: 'strategist',      name: 'Strategist',         description: 'Win 10 games.',                    icon: '🧠', category: 'combat',   xp_reward: 100  },
  { id: 'centurion',       name: 'Centurion',          description: 'Win 100 games.',                   icon: '💯', category: 'legend',   xp_reward: 500  },
  { id: 'eliminator',      name: 'Eliminator',         description: 'Eliminate 10 opponents.',          icon: '💀', category: 'combat',   xp_reward: 75   },
  { id: 'speed_demon',     name: 'Speed Demon',        description: 'Win a Lightning speed game.',      icon: '⚡', category: 'combat',   xp_reward: 50   },
  { id: 'veteran',         name: 'Battle-Hardened',    description: 'Play 50 games.',                   icon: '🛡️', category: 'combat',   xp_reward: 150  },
  { id: 'cartographer',    name: 'Cartographer',       description: 'Create your first map.',           icon: '🗺️', category: 'creator',  xp_reward: 100  },
  { id: 'map_master',      name: 'Map Master',         description: 'Create 5 maps.',                   icon: '🌍', category: 'creator',  xp_reward: 200  },
  { id: 'popular_terrain', name: 'Popular Terrain',    description: 'Have a map played 50 times.',      icon: '📍', category: 'creator',  xp_reward: 200  },
  { id: 'legend',          name: 'Living Legend',      description: 'Reach level 25.',                  icon: '🌟', category: 'legend',   xp_reward: 300  },
  { id: 'supreme',         name: 'Supreme Crusader',   description: 'Reach the maximum level 50.',      icon: '👑', category: 'legend',   xp_reward: 1000 },
  { id: 'elo_1500',        name: 'Warlord',            description: 'Reach 1500 ELO.',                  icon: '🏆', category: 'legend',   xp_reward: 250  },
  { id: 'elo_2000',        name: 'Grand Strategist',   description: 'Reach 2000 ELO.',                  icon: '🎖️', category: 'legend',   xp_reward: 500  },
  { id: 'team_player',     name: 'Band of Brothers',   description: 'Win a team game.',                 icon: '🤝', category: 'explorer', xp_reward: 75   },
  { id: 'globetrotter',    name: 'Globetrotter',       description: 'Play on 10 different maps.',       icon: '🌐', category: 'explorer', xp_reward: 150  },
]

// ─── Preset DiceBear avatars ──────────────────────────────────────────────────

export const PRESET_AVATARS = [
  { id: 'warrior',    url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Warrior&backgroundColor=0d1b2a'    },
  { id: 'crusader',   url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Crusader&backgroundColor=0d1b2a'   },
  { id: 'knight',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Knight&backgroundColor=0d1b2a'     },
  { id: 'paladin',    url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Paladin&backgroundColor=0d1b2a'    },
  { id: 'templar',    url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Templar&backgroundColor=0d1b2a'    },
  { id: 'archer',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Archer&backgroundColor=0d1b2a'     },
  { id: 'mage',       url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mage&backgroundColor=0d1b2a'       },
  { id: 'berserker',  url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Berserker&backgroundColor=0d1b2a'  },
  { id: 'commander',  url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Commander&backgroundColor=0d1b2a'  },
  { id: 'conqueror',  url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Conqueror&backgroundColor=0d1b2a'  },
  { id: 'overlord',   url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Overlord&backgroundColor=0d1b2a'   },
  { id: 'emperor',    url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Emperor&backgroundColor=0d1b2a'    },
]

export const PLAYER_COLORS = [
  { value: '#E74C3C', label: 'Crimson'  },
  { value: '#3498DB', label: 'Sapphire' },
  { value: '#2ECC71', label: 'Emerald'  },
  { value: '#F39C12', label: 'Amber'    },
  { value: '#9B59B6', label: 'Amethyst' },
  { value: '#1ABC9C', label: 'Jade'     },
]
