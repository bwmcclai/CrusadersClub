'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  Trophy, TrendingUp, Sword, Map, Crown, ChevronUp, ChevronDown,
  Minus, Search, Star, Shield, Users, Zap,
} from 'lucide-react'
import { getTierForLevel, PRESET_AVATARS } from '@/lib/xp'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PLAYERS = [
  { id: '1', username: 'GirthQuake_69', avatar: PRESET_AVATARS[11].url, level: 50, elo: 2941, wins: 387, losses: 89, games: 476, maps: 8, delta: 0 },
  { id: '2', username: 'Throbbin_Hood', avatar: PRESET_AVATARS[0].url, level: 48, elo: 2847, wins: 312, losses: 100, games: 412, maps: 3, delta: +2 },
  { id: '3', username: 'Dixie_Normous', avatar: PRESET_AVATARS[10].url, level: 47, elo: 2793, wins: 295, losses: 108, games: 403, maps: 6, delta: -1 },
  { id: '4', username: 'Hugh_Jass_666', avatar: PRESET_AVATARS[8].url, level: 45, elo: 2712, wins: 271, losses: 112, games: 383, maps: 2, delta: +1 },
  { id: '5', username: 'Barry_McCockner', avatar: PRESET_AVATARS[4].url, level: 44, elo: 2655, wins: 254, losses: 119, games: 373, maps: 4, delta: -2 },
  { id: '6', username: 'Moe_Lester_Official', avatar: PRESET_AVATARS[2].url, level: 42, elo: 2589, wins: 237, losses: 127, games: 364, maps: 1, delta: +3 },
  { id: '7', username: 'Panty_Raider_99', avatar: PRESET_AVATARS[8].url, level: 40, elo: 2521, wins: 219, losses: 138, games: 357, maps: 5, delta: 0 },
  { id: '8', username: 'Sloppy_Toppy_Joe', avatar: PRESET_AVATARS[7].url, level: 38, elo: 2478, wins: 201, losses: 147, games: 348, maps: 0, delta: -1 },
  { id: '9', username: 'Ben_Dover_N_Take_It', avatar: PRESET_AVATARS[9].url, level: 37, elo: 2431, wins: 188, losses: 152, games: 340, maps: 7, delta: +2 },
  { id: '10', username: 'Wet_Ass_P-word', avatar: PRESET_AVATARS[6].url, level: 35, elo: 2387, wins: 176, losses: 158, games: 334, maps: 2, delta: -3 },
  { id: '11', username: 'Mike_Litoris', avatar: PRESET_AVATARS[1].url, level: 34, elo: 2334, wins: 163, losses: 164, games: 327, maps: 3, delta: +1 },
  { id: '12', username: 'Dong_Zilla_v2', avatar: PRESET_AVATARS[5].url, level: 32, elo: 2289, wins: 152, losses: 169, games: 321, maps: 0, delta: 0 },
  { id: '13', username: 'Cheeks_Clapper_MD', avatar: PRESET_AVATARS[3].url, level: 30, elo: 2241, wins: 141, losses: 175, games: 316, maps: 1, delta: +4 },
  { id: '14', username: 'Sweaty_Left_Nut', avatar: PRESET_AVATARS[5].url, level: 29, elo: 2198, wins: 131, losses: 181, games: 312, maps: 2, delta: -2 },
  { id: '15', username: 'Creamy_Bottom_Text', avatar: PRESET_AVATARS[3].url, level: 27, elo: 2154, wins: 121, losses: 187, games: 308, maps: 0, delta: +1 },
  { id: '16', username: 'Gluck_Gluck_9000', avatar: PRESET_AVATARS[7].url, level: 25, elo: 2109, wins: 112, losses: 193, games: 305, maps: 4, delta: -1 },
  { id: '17', username: 'Stepsis_Im_Stuck', avatar: PRESET_AVATARS[6].url, level: 24, elo: 2063, wins: 103, losses: 199, games: 302, maps: 0, delta: +2 },
  { id: '18', username: 'Big_Coq_Energy', avatar: PRESET_AVATARS[1].url, level: 22, elo: 2018, wins: 95, losses: 205, games: 300, maps: 1, delta: -3 },
  { id: '19', username: 'The_Clit_Commander', avatar: PRESET_AVATARS[4].url, level: 20, elo: 1974, wins: 88, losses: 210, games: 298, maps: 2, delta: +1 },
  { id: '20', username: 'RawDog_Richie', avatar: PRESET_AVATARS[0].url, level: 19, elo: 1932, wins: 81, losses: 215, games: 296, maps: 0, delta: 0 }
]

type Category = 'elo' | 'winrate' | 'victories' | 'creators'
type Period = 'alltime' | 'season' | 'month'

function winRate(p: typeof MOCK_PLAYERS[0]) {
  return Math.round((p.wins / p.games) * 100)
}

function sortedPlayers(players: typeof MOCK_PLAYERS, cat: Category) {
  return [...players].sort((a, b) => {
    if (cat === 'elo') return b.elo - a.elo
    if (cat === 'winrate') return winRate(b) - winRate(a)
    if (cat === 'victories') return b.wins - a.wins
    if (cat === 'creators') return b.maps - a.maps
    return 0
  })
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumPlayer({
  player, position, value, valueLabel,
}: {
  player: typeof MOCK_PLAYERS[0]
  position: 1 | 2 | 3
  value: string | number
  valueLabel: string
}) {
  const tier = getTierForLevel(player.level)
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' }
  const sizes = { 1: 'w-20 h-20', 2: 'w-16 h-16', 3: 'w-16 h-16' }
  const medals = {
    1: { bg: 'bg-yellow-500/20 border-yellow-400/50', glow: 'shadow-[0_0_40px_rgba(234,179,8,0.3)]', text: 'text-yellow-300' },
    2: { bg: 'bg-gray-400/10 border-gray-400/30', glow: 'shadow-[0_0_20px_rgba(156,163,175,0.2)]', text: 'text-gray-300' },
    3: { bg: 'bg-orange-700/10 border-orange-700/30', glow: 'shadow-[0_0_20px_rgba(180,83,9,0.15)]', text: 'text-orange-400' },
  }
  const m = medals[position]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position === 1 ? 0.1 : position === 2 ? 0.3 : 0.5, duration: 0.6 }}
      className={`flex flex-col items-center gap-3 ${position === 1 ? 'order-2' : position === 2 ? 'order-1' : 'order-3'}`}
    >
      {/* Crown for #1 */}
      {position === 1 && (
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
        >
          <Crown size={28} />
        </motion.div>
      )}

      {/* Avatar */}
      <div className={`relative ${position !== 1 ? 'mt-8' : ''}`}>
        <div className={`${m.glow} rounded-full`}>
          <img
            src={player.avatar}
            alt={player.username}
            style={{ borderColor: tier.color }}
            className={`${sizes[position]} rounded-full border-[3px] object-cover bg-crusader-navy`}
          />
        </div>
        {/* Rank badge */}
        <div className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-cinzel font-black ${m.bg} ${m.text}`}>
          {position}
        </div>
      </div>

      {/* Name + tier */}
      <div className="text-center">
        <p className={`font-cinzel font-bold text-sm ${position === 1 ? 'text-yellow-300 text-base' : 'text-crusader-gold-light/80'}`}>
          {player.username}
        </p>
        <p className="text-xs mt-0.5" style={{ color: tier.color }}>
          Lv {player.level} · {tier.title}
        </p>
      </div>

      {/* Value pill */}
      <div className={`px-3 py-1 rounded-full text-xs font-bold border ${m.bg} ${m.text}`}>
        {value} <span className="opacity-60 font-normal">{valueLabel}</span>
      </div>

      {/* Podium block */}
      <div className={`w-24 sm:w-32 ${heights[position]} rounded-t-lg border-t border-x flex items-start justify-center pt-2 ${position === 1
        ? 'bg-gradient-to-b from-yellow-500/10 to-yellow-500/5 border-yellow-400/30'
        : position === 2
          ? 'bg-gradient-to-b from-gray-400/10 to-gray-400/5 border-gray-400/20'
          : 'bg-gradient-to-b from-orange-700/10 to-orange-700/5 border-orange-700/20'
        }`}>
        <span className={`font-cinzel font-black text-lg opacity-30 ${m.text}`}>
          #{position}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) return <Minus size={12} className="text-crusader-gold/30" />
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-green-400 text-xs font-bold">
      <ChevronUp size={12} />{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-crusader-crimson-bright text-xs font-bold">
      <ChevronDown size={12} />{Math.abs(delta)}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [category, setCategory] = useState<Category>('elo')
  const [period, setPeriod] = useState<Period>('alltime')
  const [search, setSearch] = useState('')

  const sorted = sortedPlayers(MOCK_PLAYERS, category)
  const filtered = sorted.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  )

  const top3 = sorted.slice(0, 3)

  function primaryValue(p: typeof MOCK_PLAYERS[0]) {
    if (category === 'elo') return { value: p.elo, label: 'ELO' }
    if (category === 'winrate') return { value: `${winRate(p)}%`, label: 'WR' }
    if (category === 'victories') return { value: p.wins, label: 'wins' }
    return { value: p.maps, label: 'maps' }
  }

  const categories: { id: Category; label: string; icon: React.ReactNode }[] = [
    { id: 'elo', label: 'ELO Rating', icon: <Shield size={14} /> },
    { id: 'winrate', label: 'Win Rate', icon: <TrendingUp size={14} /> },
    { id: 'victories', label: 'Victories', icon: <Sword size={14} /> },
    { id: 'creators', label: 'Creators', icon: <Map size={14} /> },
  ]

  const periods: { id: Period; label: string }[] = [
    { id: 'alltime', label: 'All Time' },
    { id: 'season', label: 'Season 1' },
    { id: 'month', label: 'This Month' },
  ]

  return (
    <div className="min-h-screen bg-crusader-void overflow-hidden">
      <Navbar />

      {/* ── Background atmosphere ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-crusader-gold/3 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-crusader-crimson/3 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-crusader-glow/3 rounded-full blur-[100px]" />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-crusader-gold/50" />
            <Trophy size={20} className="text-crusader-gold" />
            <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-crusader-gold/50" />
          </div>
          <h1 className="font-cinzel text-4xl sm:text-5xl font-black text-crusader-gold tracking-wider glow-gold">
            LEADERBOARD
          </h1>
          <p className="text-crusader-gold/50 text-sm mt-2 font-cinzel tracking-widest">
            SEASON 1 · {MOCK_PLAYERS.length.toLocaleString()} COMMANDERS RANKED
          </p>
        </motion.div>

        {/* ── Category tabs ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex gap-1 p-1 rounded-2xl bg-crusader-navy/60 border border-crusader-gold/10">
            {categories.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-cinzel font-semibold tracking-wide transition-all duration-200 ${category === id
                  ? 'bg-crusader-gold/20 text-crusader-gold border border-crusader-gold/30 shadow-glow-gold'
                  : 'text-crusader-gold/40 hover:text-crusader-gold/70 border border-transparent'
                  }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Time period + search row ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-12"
        >
          <div className="flex gap-2">
            {periods.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold tracking-wide transition-all border ${period === id
                  ? 'bg-crusader-gold/15 text-crusader-gold border-crusader-gold/30'
                  : 'text-crusader-gold/30 border-crusader-gold/10 hover:border-crusader-gold/20 hover:text-crusader-gold/50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-crusader-gold/30" />
            <input
              type="text"
              placeholder="Search commanders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl bg-crusader-navy/60 border border-crusader-gold/20 text-sm text-crusader-gold-light placeholder:text-crusader-gold/25 focus:outline-none focus:border-crusader-gold/50"
            />
          </div>
        </motion.div>

        {/* ── Podium ──────────────────────────────────────────────────────── */}
        {!search && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <div className="flex items-end justify-center gap-4 sm:gap-8">
              {([top3[1], top3[0], top3[2]] as const).map((p, i) => {
                const pos = i === 0 ? 2 : i === 1 ? 1 : 3
                const { value, label } = primaryValue(p)
                return (
                  <PodiumPlayer
                    key={p.id}
                    player={p}
                    position={pos as 1 | 2 | 3}
                    value={value}
                    valueLabel={label}
                  />
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Rankings table ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_auto_auto_auto_auto] sm:grid-cols-[2.5rem_2.5rem_1fr_auto_auto_auto_auto_auto] gap-x-3 px-4 pb-2 mb-2">
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest">#</span>
            <span className="hidden sm:block text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest">Δ</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest">Commander</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest text-right hidden sm:block">ELO</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest text-right">W/L</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest text-right hidden md:block">Win%</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest text-right hidden lg:block">Games</span>
            <span className="text-[10px] text-crusader-gold/30 font-cinzel uppercase tracking-widest text-right hidden lg:block">Maps</span>
          </div>

          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((player, idx) => {
                const globalRank = sorted.indexOf(player) + 1
                const tier = getTierForLevel(player.level)
                const wr = winRate(player)
                const isTop3 = globalRank <= 3
                const { value } = primaryValue(player)

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.03, duration: 0.3 }}
                    layout
                  >
                    <Link href={`/players`}>
                      <div className={`grid grid-cols-[2.5rem_1fr_auto_auto_auto_auto] sm:grid-cols-[2.5rem_2.5rem_1fr_auto_auto_auto_auto_auto] gap-x-3 items-center px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer group ${isTop3
                        ? globalRank === 1
                          ? 'bg-yellow-500/5 border-yellow-400/20 hover:bg-yellow-500/10 hover:border-yellow-400/40'
                          : globalRank === 2
                            ? 'bg-gray-400/5 border-gray-400/15 hover:bg-gray-400/10 hover:border-gray-400/30'
                            : 'bg-orange-700/5 border-orange-700/15 hover:bg-orange-700/10 hover:border-orange-700/25'
                        : 'bg-crusader-navy/30 border-crusader-gold/5 hover:bg-crusader-navy/60 hover:border-crusader-gold/20'
                        }`}>
                        {/* Rank */}
                        <span className={`font-cinzel font-black text-sm text-center ${globalRank === 1 ? 'text-yellow-400' :
                          globalRank === 2 ? 'text-gray-300' :
                            globalRank === 3 ? 'text-orange-400' :
                              'text-crusader-gold/40'
                          }`}>
                          {globalRank <= 3 ? ['🥇', '🥈', '🥉'][globalRank - 1] : globalRank}
                        </span>

                        {/* Delta */}
                        <div className="hidden sm:flex justify-center">
                          <RankDelta delta={player.delta} />
                        </div>

                        {/* Player info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={player.avatar}
                              alt={player.username}
                              style={{ borderColor: tier.color }}
                              className="w-9 h-9 rounded-full border-2 object-cover bg-crusader-navy"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-cinzel font-semibold text-sm text-crusader-gold-light/90 group-hover:text-crusader-gold truncate">
                              {player.username}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ color: tier.color, backgroundColor: tier.color + '22', border: `1px solid ${tier.color}44` }}
                              >
                                {tier.title}
                              </span>
                              <span className="text-[10px] text-crusader-gold/30">Lv {player.level}</span>
                            </div>
                          </div>
                        </div>

                        {/* ELO */}
                        <span className="hidden sm:block text-right font-cinzel font-bold text-sm text-crusader-gold tabular-nums">
                          {player.elo.toLocaleString()}
                        </span>

                        {/* W/L */}
                        <span className="text-right text-xs text-crusader-gold/60 tabular-nums whitespace-nowrap">
                          <span className="text-green-400/80">{player.wins}</span>
                          <span className="text-crusader-gold/30">/</span>
                          <span className="text-crusader-crimson-bright/60">{player.losses}</span>
                        </span>

                        {/* Win % */}
                        <div className="hidden md:flex flex-col items-end gap-1">
                          <span className={`text-xs font-bold tabular-nums ${wr >= 60 ? 'text-green-400' : wr >= 45 ? 'text-crusader-gold' : 'text-crusader-gold/50'}`}>
                            {wr}%
                          </span>
                        </div>

                        {/* Games */}
                        <span className="hidden lg:block text-right text-xs text-crusader-gold/40 tabular-nums">
                          {player.games}
                        </span>

                        {/* Maps */}
                        <span className="hidden lg:block text-right text-xs text-crusader-gold/40 tabular-nums">
                          {player.maps}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Trophy size={48} className="mx-auto text-crusader-gold/15 mb-4" />
              <p className="text-crusader-gold/40 font-cinzel">No commanders found</p>
            </div>
          )}
        </motion.div>

        {/* ── Footer CTA ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-crusader-gold/30 text-sm font-cinzel mb-4">
            Your rank: <span className="text-crusader-gold font-bold">#342</span> — Keep fighting, Commander
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/lobby">
              <Button icon={<Sword size={16} />}>Find a Battle</Button>
            </Link>
            <Link href="/players">
              <Button variant="outline" icon={<Users size={16} />}>Find Players</Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
