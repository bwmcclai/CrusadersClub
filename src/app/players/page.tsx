'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import {
  Search, Users, Trophy, Sword, TrendingUp, Map, Shield,
  Star, Zap, Clock, X, UserPlus, Swords, ChevronDown,
} from 'lucide-react'
import { getTierForLevel, PRESET_AVATARS, LEVEL_TIERS } from '@/lib/xp'

// ─── Mock Players ─────────────────────────────────────────────────────────────

const ALL_PLAYERS = [

    { id: '1', username: 'GirthQuake_69', avatar: PRESET_AVATARS[11].url, level: 50, elo: 2941, wins: 387, losses: 89, games: 476, maps: 8, online: true, lastSeen: 'Online now' },
    { id: '2', username: 'Throbbin_Hood', avatar: PRESET_AVATARS[0].url, level: 48, elo: 2847, wins: 312, losses: 100, games: 412, maps: 3, online: true, lastSeen: 'Online now' },
    { id: '3', username: 'Dixie_Normous', avatar: PRESET_AVATARS[10].url, level: 47, elo: 2793, wins: 295, losses: 108, games: 403, maps: 6, online: false, lastSeen: '2h ago' },
    { id: '4', username: 'Hugh_Jass_666', avatar: PRESET_AVATARS[8].url, level: 45, elo: 2712, wins: 271, losses: 112, games: 383, maps: 2, online: true, lastSeen: 'Online now' },
    { id: '5', username: 'Barry_McCockner', avatar: PRESET_AVATARS[4].url, level: 44, elo: 2655, wins: 254, losses: 119, games: 373, maps: 4, online: false, lastSeen: '5h ago' },
    { id: '6', username: 'Moe_Lester_Official', avatar: PRESET_AVATARS[2].url, level: 42, elo: 2589, wins: 237, losses: 127, games: 364, maps: 1, online: false, lastSeen: '1d ago' },
    { id: '7', username: 'Panty_Raider_99', avatar: PRESET_AVATARS[8].url, level: 40, elo: 2521, wins: 219, losses: 138, games: 357, maps: 5, online: true, lastSeen: 'Online now' },
    { id: '8', username: 'Sloppy_Toppy_Joe', avatar: PRESET_AVATARS[7].url, level: 38, elo: 2478, wins: 201, losses: 147, games: 348, maps: 0, online: false, lastSeen: '3h ago' },
    { id: '9', username: 'Ben_Dover_N_Take_It', avatar: PRESET_AVATARS[9].url, level: 37, elo: 2431, wins: 188, losses: 152, games: 340, maps: 7, online: true, lastSeen: 'Online now' },
    { id: '10', username: 'Wet_Ass_P-word', avatar: PRESET_AVATARS[6].url, level: 35, elo: 2387, wins: 176, losses: 158, games: 334, maps: 2, online: false, lastSeen: '12h ago' },
    { id: '11', username: 'Mike_Litoris', avatar: PRESET_AVATARS[1].url, level: 34, elo: 2334, wins: 163, losses: 164, games: 327, maps: 3, online: false, lastSeen: '2d ago' },
    { id: '12', username: 'Dong_Zilla_v2', avatar: PRESET_AVATARS[5].url, level: 32, elo: 2289, wins: 152, losses: 169, games: 321, maps: 0, online: true, lastSeen: 'Online now' },
    { id: '13', username: 'Cheeks_Clapper_MD', avatar: PRESET_AVATARS[3].url, level: 30, elo: 2241, wins: 141, losses: 175, games: 316, maps: 1, online: false, lastSeen: '6h ago' },
    { id: '14', username: 'Sweaty_Left_Nut', avatar: PRESET_AVATARS[5].url, level: 29, elo: 2198, wins: 131, losses: 181, games: 312, maps: 2, online: false, lastSeen: '1d ago' },
    { id: '15', username: 'Creamy_Bottom_Text', avatar: PRESET_AVATARS[3].url, level: 27, elo: 2154, wins: 121, losses: 187, games: 308, maps: 0, online: true, lastSeen: 'Online now' },
    { id: '16', username: 'Gluck_Gluck_9000', avatar: PRESET_AVATARS[7].url, level: 25, elo: 2109, wins: 112, losses: 193, games: 305, maps: 4, online: false, lastSeen: '4h ago' },
    { id: '17', username: 'Stepsis_Im_Stuck', avatar: PRESET_AVATARS[6].url, level: 24, elo: 2063, wins: 103, losses: 199, games: 302, maps: 0, online: false, lastSeen: '2d ago' },
    { id: '18', username: 'Big_Coq_Energy', avatar: PRESET_AVATARS[1].url, level: 22, elo: 2018, wins: 95, losses: 205, games: 300, maps: 1, online: true, lastSeen: 'Online now' },
    { id: '19', username: 'The_Clit_Commander', avatar: PRESET_AVATARS[4].url, level: 20, elo: 1974, wins: 88, losses: 210, games: 298, maps: 2, online: false, lastSeen: '1d ago' },
    { id: '20', username: 'RawDog_Richie', avatar: PRESET_AVATARS[0].url, level: 19, elo: 1932, wins: 81, losses: 215, games: 296, maps: 0, online: false, lastSeen: '3d ago' },
    { id: '21', username: 'Suck_My_Unit_69', avatar: PRESET_AVATARS[2].url, level: 18, elo: 1887, wins: 74, losses: 220, games: 294, maps: 0, online: true, lastSeen: 'Online now' },
    { id: '22', username: 'Buster_Hymen', avatar: PRESET_AVATARS[9].url, level: 16, elo: 1843, wins: 68, losses: 225, games: 293, maps: 3, online: false, lastSeen: '5h ago' },
    { id: '23', username: 'Anita_Dump_Now', avatar: PRESET_AVATARS[6].url, level: 14, elo: 1798, wins: 62, losses: 230, games: 292, maps: 1, online: false, lastSeen: '2d ago' },
    { id: '24', username: 'I_F_U_K_E_D_M_O_M', avatar: PRESET_AVATARS[4].url, level: 12, elo: 1754, wins: 57, losses: 235, games: 292, maps: 0, online: true, lastSeen: 'Online now' }
  ]

type SortOption = 'elo' | 'winrate' | 'level' | 'victories'
type TierFilter = 'all' | string

// ─── Player Profile Modal ─────────────────────────────────────────────────────

function PlayerModal({
  player,
  onClose,
}: {
  player: typeof ALL_PLAYERS[0] | null
  onClose: () => void
}) {
  if (!player) return null
  const tier = getTierForLevel(player.level)
  const wr = Math.round((player.wins / player.games) * 100)
  const rank = ALL_PLAYERS.sort((a, b) => b.elo - a.elo).indexOf(player) + 1

  const stats = [
    { label: 'ELO Rating', value: player.elo.toLocaleString(), icon: <Shield size={14} />, color: 'text-crusader-glow' },
    { label: 'Victories', value: player.wins, icon: <Trophy size={14} />, color: 'text-yellow-400' },
    { label: 'Win Rate', value: `${wr}%`, icon: <TrendingUp size={14} />, color: wr >= 55 ? 'text-green-400' : 'text-crusader-gold' },
    { label: 'Games Played', value: player.games, icon: <Sword size={14} />, color: 'text-crusader-gold' },
    { label: 'Maps Created', value: player.maps, icon: <Map size={14} />, color: 'text-crusader-ice' },
    { label: 'Global Rank', value: `#${rank}`, icon: <Star size={14} />, color: 'text-yellow-400' },
  ]

  return (
    <Modal open={!!player} onClose={onClose} title="" size="md">
      <div className="-mt-4">
        {/* Profile hero */}
        <div className="relative flex flex-col items-center gap-3 pb-6 mb-6 border-b border-crusader-gold/10">
          {/* Online indicator */}
          <div className="absolute top-0 right-0 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${player.online ? 'bg-green-400 animate-pulse' : 'bg-crusader-gold/20'}`} />
            <span className={`text-xs font-medium ${player.online ? 'text-green-400' : 'text-crusader-gold/30'}`}>
              {player.lastSeen}
            </span>
          </div>

          <div className="relative">
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full blur-lg opacity-40"
              style={{ backgroundColor: tier.color }}
            />
            <img
              src={player.avatar}
              alt={player.username}
              style={{ borderColor: tier.color }}
              className="relative w-24 h-24 rounded-full border-[3px] object-cover bg-crusader-navy"
            />
            {/* Level badge */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-cinzel font-black border"
              style={{ color: tier.color, backgroundColor: tier.color + '20', borderColor: tier.color + '60' }}
            >
              {player.level}
            </div>
          </div>

          <div className="text-center mt-1">
            <h2 className="font-cinzel text-xl font-bold text-crusader-gold">{player.username}</h2>
            <p className="text-sm mt-0.5" style={{ color: tier.color }}>{tier.title}</p>
          </div>

          {/* ELO + rank pill row */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-crusader-navy/60 border border-crusader-gold/20 text-center">
              <p className="text-[10px] text-crusader-gold/50 font-cinzel tracking-widest uppercase">ELO</p>
              <p className="font-cinzel font-black text-lg text-crusader-gold">{player.elo.toLocaleString()}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-crusader-navy/60 border border-crusader-gold/20 text-center">
              <p className="text-[10px] text-crusader-gold/50 font-cinzel tracking-widest uppercase">Rank</p>
              <p className="font-cinzel font-black text-lg text-yellow-400">#{rank}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-crusader-navy/60 border border-crusader-gold/20 text-center">
              <p className="text-[10px] text-crusader-gold/50 font-cinzel tracking-widest uppercase">Win%</p>
              <p className={`font-cinzel font-black text-lg ${wr >= 55 ? 'text-green-400' : 'text-crusader-gold'}`}>{wr}%</p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map(({ label, value, icon, color }) => (
            <div key={label} className="bg-crusader-navy/40 rounded-xl p-3 border border-crusader-gold/10 text-center">
              <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>{icon}</div>
              <p className={`font-cinzel font-bold text-sm ${color}`}>{value}</p>
              <p className="text-[10px] text-crusader-gold/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* W/L bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-crusader-gold/50 mb-1.5">
            <span className="text-green-400/80">{player.wins} Wins</span>
            <span className="text-crusader-crimson-bright/60">{player.losses} Losses</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-crusader-navy/60 border border-crusader-gold/10">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
              style={{ width: `${wr}%` }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Link href="/lobby" className="flex-1">
            <Button fullWidth icon={<Swords size={16} />}>
              Challenge to Battle
            </Button>
          </Link>
          <Link href="/profile" className="flex-1">
            <Button fullWidth variant="outline" icon={<UserPlus size={16} />}>
              View Full Profile
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  )
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  rank,
  onClick,
}: {
  player: typeof ALL_PLAYERS[0]
  rank: number
  onClick: () => void
}) {
  const tier = getTierForLevel(player.level)
  const wr = Math.round((player.wins / player.games) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative bg-crusader-navy/40 border border-crusader-gold/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-crusader-gold/30 hover:bg-crusader-navy/70 hover:shadow-glow-gold">
        {/* Online dot */}
        {player.online && (
          <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse z-10" />
        )}

        {/* Top section */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-md"
                style={{ backgroundColor: tier.color }}
              />
              <img
                src={player.avatar}
                alt={player.username}
                style={{ borderColor: tier.color }}
                className="relative w-14 h-14 rounded-full border-2 object-cover bg-crusader-navy"
              />
              {/* Rank badge */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-crusader-void border border-crusader-gold/30 flex items-center justify-center">
                <span className="text-[9px] font-cinzel font-black text-crusader-gold/70">{rank}</span>
              </div>
            </div>

            {/* Name + tier */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="font-cinzel font-bold text-sm text-crusader-gold-light/90 group-hover:text-crusader-gold truncate transition-colors">
                {player.username}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ color: tier.color, backgroundColor: tier.color + '22', border: `1px solid ${tier.color}44` }}
                >
                  {tier.title}
                </span>
                <span className="text-[10px] text-crusader-gold/30">Lv {player.level}</span>
              </div>
              <p className="text-[10px] text-crusader-gold/40 mt-1 flex items-center gap-1">
                <Clock size={9} />
                {player.lastSeen}
              </p>
            </div>

            {/* ELO */}
            <div className="text-right flex-shrink-0">
              <p className="font-cinzel font-black text-base text-crusader-gold">{player.elo.toLocaleString()}</p>
              <p className="text-[10px] text-crusader-gold/40 uppercase tracking-widest font-cinzel">ELO</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-crusader-gold/10 border-t border-crusader-gold/10">
          <div className="px-3 py-2.5 text-center">
            <p className="font-cinzel font-bold text-sm text-green-400/80">{player.wins}</p>
            <p className="text-[10px] text-crusader-gold/30">Wins</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className={`font-cinzel font-bold text-sm ${wr >= 55 ? 'text-green-400' : wr >= 45 ? 'text-crusader-gold' : 'text-crusader-gold/60'}`}>
              {wr}%
            </p>
            <p className="text-[10px] text-crusader-gold/30">Win Rate</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="font-cinzel font-bold text-sm text-crusader-gold/70">{player.games}</p>
            <p className="text-[10px] text-crusader-gold/30">Games</p>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-crusader-void/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-2xl">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-crusader-gold/20 border border-crusader-gold/40 flex items-center justify-center">
              <Users size={16} className="text-crusader-gold" />
            </div>
            <span className="text-[10px] font-cinzel text-crusader-gold/70">View Profile</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-crusader-crimson/20 border border-crusader-crimson-bright/40 flex items-center justify-center">
              <Swords size={16} className="text-crusader-crimson-bright" />
            </div>
            <span className="text-[10px] font-cinzel text-crusader-gold/70">Challenge</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [sort, setSort] = useState<SortOption>('elo')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [selected, setSelected] = useState<typeof ALL_PLAYERS[0] | null>(null)

  const onlineCount = ALL_PLAYERS.filter((p) => p.online).length

  const filtered = ALL_PLAYERS
    .filter((p) => {
      const tier = getTierForLevel(p.level)
      if (search && !p.username.toLowerCase().includes(search.toLowerCase())) return false
      if (onlineOnly && !p.online) return false
      if (tierFilter !== 'all' && tier.title !== tierFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'elo') return b.elo - a.elo
      if (sort === 'winrate') return (b.wins / b.games) - (a.wins / a.games)
      if (sort === 'level') return b.level - a.level
      if (sort === 'victories') return b.wins - a.wins
      return 0
    })

  const allSorted = [...ALL_PLAYERS].sort((a, b) => b.elo - a.elo)

  const tierOptions = ['all', ...Array.from(new Set(
    LEVEL_TIERS.map((t) => t.title)
  ))]

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'elo', label: 'ELO Rating' },
    { id: 'winrate', label: 'Win Rate' },
    { id: 'level', label: 'Level' },
    { id: 'victories', label: 'Victories' },
  ]

  return (
    <div className="min-h-screen bg-crusader-void">
      <Navbar />

      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[400px] bg-crusader-glow/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-crusader-gold/3 rounded-full blur-[100px]" />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-crusader-gold/60 text-xs font-cinzel tracking-widest uppercase mb-1">Browse</p>
              <h1 className="font-cinzel text-4xl font-black text-crusader-gold glow-gold">Commanders</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-crusader-gold/50">
                  <span className="text-crusader-gold font-semibold">{ALL_PLAYERS.length}</span> players registered
                </span>
                <span className="flex items-center gap-1.5 text-sm text-green-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {onlineCount} online now
                </span>
              </div>
            </div>
            <Link href="/leaderboard">
              <Button variant="outline" icon={<Trophy size={16} />} size="sm">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 mb-8"
        >
          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-crusader-gold/30" />
              <input
                type="text"
                placeholder="Search by username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-crusader-navy/60 border border-crusader-gold/20 text-sm text-crusader-gold-light placeholder:text-crusader-gold/25 focus:outline-none focus:border-crusader-gold/50"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-crusader-navy/60 border border-crusader-gold/20 text-sm text-crusader-gold-light focus:outline-none focus:border-crusader-gold/50 cursor-pointer"
              >
                {sortOptions.map(({ id, label }) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-crusader-gold/40 pointer-events-none" />
            </div>

            {/* Online toggle */}
            <button
              onClick={() => setOnlineOnly((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-cinzel font-semibold transition-all whitespace-nowrap ${onlineOnly
                  ? 'bg-green-500/15 border-green-500/40 text-green-400'
                  : 'bg-transparent border-crusader-gold/15 text-crusader-gold/40 hover:border-crusader-gold/30'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-green-400 animate-pulse' : 'bg-crusader-gold/30'}`} />
              Online Only
            </button>
          </div>

          {/* Tier filter chips */}
          <div className="flex flex-wrap gap-2">
            {tierOptions.map((tier) => {
              const tierDef = LEVEL_TIERS.find((t) => t.title === tier)
              return (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  style={tierFilter === tier && tier !== 'all' ? {
                    backgroundColor: (tierDef?.color ?? '#C9A84C') + '22',
                    borderColor: (tierDef?.color ?? '#C9A84C') + '66',
                    color: tierDef?.color ?? '#C9A84C',
                  } : undefined}
                  className={`px-3 py-1.5 rounded-full text-xs font-cinzel font-semibold transition-all border ${tierFilter === tier
                      ? tier === 'all'
                        ? 'bg-crusader-gold/20 border-crusader-gold/40 text-crusader-gold'
                        : ''
                      : 'bg-transparent border-crusader-gold/10 text-crusader-gold/40 hover:border-crusader-gold/25 hover:text-crusader-gold/60'
                    }`}
                >
                  {tier === 'all' ? 'All Ranks' : tier}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* ── Results count ────────────────────────────────────────────────── */}
        <p className="text-xs text-crusader-gold/30 font-cinzel mb-5">
          Showing {filtered.length} commander{filtered.length !== 1 ? 's' : ''}
          {tierFilter !== 'all' ? ` · ${tierFilter}` : ''}
          {onlineOnly ? ' · Online only' : ''}
        </p>

        {/* ── Player grid ─────────────────────────────────────────────────── */}
        <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                rank={allSorted.indexOf(player) + 1}
                onClick={() => setSelected(player)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-24">
            <Users size={48} className="mx-auto text-crusader-gold/15 mb-4" />
            <p className="text-crusader-gold/40 font-cinzel text-lg">No commanders found</p>
            <p className="text-crusader-gold/20 text-sm mt-2">Try adjusting your filters</p>
            <Button
              variant="ghost"
              className="mt-6"
              onClick={() => { setSearch(''); setTierFilter('all'); setOnlineOnly(false) }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>

      {/* ── Player modal ─────────────────────────────────────────────────── */}
      <PlayerModal player={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
