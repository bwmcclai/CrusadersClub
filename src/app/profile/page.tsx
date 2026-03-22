'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Camera, Check, X, Upload, Sword, Map, Trophy,
  TrendingUp, Shield, Clock, ChevronRight, Lock, Star,
  Zap, Crown, AlertCircle,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FlagAvatar from '@/components/ui/FlagAvatar'
import { useAppStore } from '@/lib/store'
import { getSupabaseClient } from '@/lib/supabase'
import {
  computeLevelProgress, getTierForLevel, LEVEL_UNLOCKS, ACHIEVEMENTS,
  PRESET_AVATARS, PLAYER_COLORS, MAX_LEVEL,
} from '@/lib/xp'
import type { PlayerAchievement } from '@/types'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'customize' | 'progression' | 'history' | 'maps'

interface GameHistoryRow {
  id: string
  game_id: string
  game_name: string
  map_name: string
  mode: string
  result: 'victory' | 'defeat' | 'eliminated'
  date: string
  players: number
  elo_delta?: number
}

interface UserMap {
  id: string
  name: string
  region_name: string
  territory_count: number
  play_count: number
  is_public: boolean
  created_at: string
}

// ─── PlayerAvatar (large) ─────────────────────────────────────────────────────

function ProfileAvatar({ size = 96, editing = false, onUploadClick }: {
  size?: number
  editing?: boolean
  onUploadClick?: () => void
}) {
  const player = useAppStore((s) => s.player)
  if (!player) return null

  const tier = getTierForLevel(player.level)

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* Tier ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${tier.color} 0deg, ${tier.color}44 360deg)`,
          padding: 3,
          borderRadius: '50%',
        }}
      >
        <div className="w-full h-full rounded-full bg-crusader-dark overflow-hidden flex items-center justify-center">
          <FlagAvatar 
            flagId={player?.avatar_url ?? null} 
            size={size - 6} // Adjusted for tier ring padding
            fallbackLetter={player.username[0]}
            fallbackColor={player.default_color}
            className="border-none"
          />
        </div>
      </div>

      {/* Edit overlay */}
      {editing && (
        <button
          onClick={onUploadClick}
          className="absolute inset-0 rounded-full flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity group"
        >
          <Camera size={size * 0.25} className="text-crusader-gold" />
        </button>
      )}

      {/* Level badge */}
      <div
        className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-crusader-dark font-cinzel font-bold text-xs"
        style={{
          width: size * 0.36, height: size * 0.36,
          backgroundColor: tier.color,
          color: '#04060D',
          fontSize: Math.max(9, size * 0.13),
        }}
      >
        {player.level}
      </div>
    </div>
  )
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────

function XpBar({ showLabel = true }: { showLabel?: boolean }) {
  const player = useAppStore((s) => s.player)
  if (!player) return null

  const { level, currentLevelXp, nextLevelXp, progress } = computeLevelProgress(player.xp)
  const tier = getTierForLevel(level)

  return (
    <div className={showLabel ? 'space-y-1.5' : ''}>
      {showLabel && (
        <div className="flex justify-between items-baseline text-xs">
          <span className="font-cinzel font-semibold" style={{ color: tier.color }}>
            {tier.title}
          </span>
          {level < MAX_LEVEL ? (
            <span className="text-crusader-gold/40">
              {currentLevelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
            </span>
          ) : (
            <span className="text-crusader-gold/60">MAX LEVEL</span>
          )}
        </div>
      )}
      <div className="h-2 rounded-full bg-crusader-dark border border-crusader-gold/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})` }}
        />
      </div>
    </div>
  )
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router   = useRouter()
  const { player, setPlayer } = useAppStore()
  const [tab, setTab] = useState<Tab>('overview')

  // Redirect if not logged in (middleware handles this too)
  useEffect(() => {
    if (player === null) router.push('/auth/login')
  }, [player, router])

  if (!player) {
    return (
      <div className="min-h-screen bg-crusader-void flex items-center justify-center">
        <div className="font-cinzel text-crusader-gold animate-pulse">Loading...</div>
      </div>
    )
  }

  const tier      = getTierForLevel(player.level)
  const winRate   = player.games_played > 0
    ? Math.round((player.games_won / player.games_played) * 100)
    : 0
  const { progress, currentLevelXp, nextLevelXp } = computeLevelProgress(player.xp)

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'overview',    label: 'Overview',    icon: User    },
    { id: 'customize',   label: 'Customize',   icon: Camera  },
    { id: 'progression', label: 'Progression', icon: Star    },
    { id: 'history',     label: 'History',     icon: Sword   },
    { id: 'maps',        label: 'My Maps',     icon: Map     },
  ]

  return (
    <div className="min-h-screen bg-crusader-void">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-20">

        {/* ── Hero Banner ─────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden mb-8">
          {/* Banner background */}
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 30% 50%, ${tier.color}18 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #4AAFD418 0%, transparent 60%)` }}
          />
          <div className="absolute inset-0 bg-crusader-dark/80 backdrop-blur-sm border border-crusader-gold/15 rounded-3xl" />

          <div className="relative px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <ProfileAvatar size={100} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-crusader-gold glow-gold">
                  {player.username}
                </h1>
                <span
                  className="px-3 py-0.5 rounded-full text-xs font-cinzel font-bold border"
                  style={{ color: tier.color, borderColor: tier.color + '44', backgroundColor: tier.color + '18' }}
                >
                  {tier.title}
                </span>
              </div>

              {/* XP bar */}
              <div className="max-w-md mb-4">
                <XpBar />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 flex-wrap text-sm">
                {[
                  { label: 'ELO',      value: player.elo,           icon: Shield,     color: '#4AAFD4' },
                  { label: 'Games',    value: player.games_played,  icon: Sword,      color: '#C9A84C' },
                  { label: 'Wins',     value: player.games_won,     icon: Trophy,     color: '#2ECC71' },
                  { label: 'Win Rate', value: `${winRate}%`,        icon: TrendingUp, color: '#9B59B6' },
                  { label: 'XP',       value: player.xp.toLocaleString(), icon: Zap, color: tier.color },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon size={13} style={{ color }} />
                    <span className="text-crusader-gold/40 text-xs">{label}:</span>
                    <span className="font-cinzel font-bold text-sm" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit button */}
            <Button
              variant="outline"
              size="sm"
              icon={<Camera size={14} />}
              onClick={() => setTab('customize')}
            >
              Edit Profile
            </Button>
          </div>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-cinzel text-sm font-semibold tracking-wider whitespace-nowrap transition-all duration-200',
                tab === id
                  ? 'bg-crusader-gold/15 text-crusader-gold border border-crusader-gold/30 shadow-glow-gold'
                  : 'text-crusader-gold/40 hover:text-crusader-gold/70 hover:bg-crusader-gold/5 border border-transparent',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'overview'    && <OverviewTab />}
            {tab === 'customize'   && <CustomizeTab onSaved={() => setTab('overview')} />}
            {tab === 'progression' && <ProgressionTab />}
            {tab === 'history'     && <HistoryTab />}
            {tab === 'maps'        && <MapsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const player = useAppStore((s) => s.player)!
  const [history, setHistory]       = useState<GameHistoryRow[]>([])
  const [maps, setMaps]             = useState<UserMap[]>([])
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient()
      const [histRes, mapRes, achRes] = await Promise.all([
        supabase
          .from('game_players')
          .select('id, game_id, games(id, name, mode, status, winner_id, created_at, battle_maps(name)), is_eliminated')
          .eq('player_id', player.id)
          .order('joined_at', { ascending: false })
          .limit(5),
        supabase
          .from('battle_maps')
          .select('id, name, region_name, territories, play_count, is_public, created_at')
          .eq('author_id', player.id)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('player_achievements')
          .select('*, achievements(*)')
          .eq('player_id', player.id)
          .order('unlocked_at', { ascending: false })
          .limit(6),
      ])

      if (histRes.data) {
        setHistory(histRes.data.map((gp: any) => ({
          id: gp.id,
          game_id: gp.game_id,
          game_name: gp.games?.name ?? 'Unknown Battle',
          map_name: gp.games?.battle_maps?.name ?? '',
          mode: gp.games?.mode ?? '',
          result: gp.games?.winner_id === player.id
            ? 'victory'
            : gp.is_eliminated
              ? 'eliminated'
              : 'defeat',
          date: gp.games?.created_at ?? '',
          players: 0,
        })))
      }

      if (mapRes.data) {
        setMaps(mapRes.data.map((m: any) => ({
          id: m.id,
          name: m.name,
          region_name: m.region_name,
          territory_count: Array.isArray(m.territories) ? m.territories.length : 0,
          play_count: m.play_count,
          is_public: m.is_public,
          created_at: m.created_at,
        })))
      }

      if (achRes.data) setAchievements(achRes.data as any)
      setLoading(false)
    }
    load()
  }, [player.id])

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left: recent games */}
      <div className="lg:col-span-2 space-y-6">
        <SectionHeader title="Recent Battles" href="#" hrefLabel="Full history" onClick={() => {}} />
        {loading
          ? <SkeletonList count={5} />
          : history.length === 0
            ? <EmptyState icon={Sword} message="No battles recorded yet. Find a game!" />
            : (
              <Card className="divide-y divide-crusader-gold/10">
                {history.map((g) => <GameRow key={g.id} game={g} />)}
              </Card>
            )
        }

        {/* Recent achievements */}
        <SectionHeader title="Recent Achievements" />
        {loading
          ? <SkeletonList count={3} />
          : achievements.length === 0
            ? <EmptyState icon={Trophy} message="No achievements yet — keep fighting!" />
            : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {achievements.map((a) => (
                  <Card key={a.id} className="p-4 flex items-center gap-3">
                    <span className="text-2xl">{a.achievements.icon}</span>
                    <div className="min-w-0">
                      <p className="font-cinzel text-xs font-bold text-crusader-gold truncate">{a.achievements.name}</p>
                      <p className="text-[10px] text-crusader-gold/40 mt-0.5">+{a.achievements.xp_reward} XP</p>
                    </div>
                  </Card>
                ))}
              </div>
            )
        }
      </div>

      {/* Right: maps */}
      <div className="space-y-6">
        <SectionHeader title="My Maps" href="/map-creator" hrefLabel="+ New" />
        {loading
          ? <SkeletonList count={3} />
          : maps.length === 0
            ? <EmptyState icon={Map} message="No maps created yet." />
            : (
              <div className="space-y-3">
                {maps.map((m) => <MapCard key={m.id} map={m} />)}
              </div>
            )
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Customize
// ═══════════════════════════════════════════════════════════════════════════════

function CustomizeTab({ onSaved }: { onSaved: () => void }) {
  const { player, setPlayer } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [username, setUsername]         = useState(player?.username ?? '')
  const [selectedAvatar, setAvatar]     = useState(player?.avatar_url ?? '')
  const [selectedColor, setColor]       = useState(player?.default_color ?? '#E74C3C')
  const [usernameError, setUsernameErr] = useState('')
  const [checking, setChecking]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [saved, setSaved]               = useState(false)

  if (!player) return null

  const canUploadAvatar = player.level >= 5
  const { level } = computeLevelProgress(player.xp)

  async function checkUsername(val: string) {
    if (val === player!.username) { setUsernameErr(''); return }
    if (val.length < 3) { setUsernameErr('At least 3 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameErr('Only letters, numbers, underscores'); return }
    setChecking(true)
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('players').select('id').eq('username', val).maybeSingle()
    setChecking(false)
    setUsernameErr(data ? 'Username already taken' : '')
  }

  async function handleUpload(file: File) {
    if (!canUploadAvatar) return
    setUploading(true)
    const supabase = getSupabaseClient()
    const ext  = file.name.split('.').pop()
    const path = `${player!.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatar(publicUrl)
    }
    setUploading(false)
  }

  async function handleSave() {
    if (usernameError || checking || !player) return
    setSaving(true)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('players')
      .update({ username: username.trim(), avatar_url: selectedAvatar || null, default_color: selectedColor })
      .eq('id', player.id)
      .select()
      .single()

    if (!error && data) {
      setPlayer({ ...player, ...data })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* Username */}
      <Card className="p-6 space-y-4">
        <h2 className="font-cinzel text-lg font-bold text-crusader-gold flex items-center gap-2">
          <User size={16} /> Commander Name
        </h2>
        <div className="relative">
          <Input
            label="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); checkUsername(e.target.value) }}
            hint="Visible to all players on the battlefield"
            error={usernameError}
            icon={checking
              ? <div className="w-3 h-3 border border-crusader-gold border-t-transparent rounded-full animate-spin" />
              : username && !usernameError && username !== player.username
                ? <Check size={14} className="text-green-400" />
                : <User size={14} />
            }
          />
        </div>
      </Card>

      {/* Avatar Picker */}
      <Card className="p-6 space-y-4">
        <h2 className="font-cinzel text-lg font-bold text-crusader-gold flex items-center gap-2">
          <Camera size={16} /> Avatar
        </h2>
        <p className="text-xs text-crusader-gold/40">Choose a preset or upload your own (unlocked at Level 5)</p>

        {/* Flags grid */}
        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {/* Generate the 6x4 flags from Flags.png */}
            {Array.from({ length: 24 }).map((_, i) => {
              const col = i % 6
              const row = Math.floor(i / 6)
              const flagId = `flag:${col},${row}`
              const isSelected = selectedAvatar === flagId

              return (
                <button
                  key={flagId}
                  onClick={() => setAvatar(flagId)}
                  className={cn(
                    'rounded-lg overflow-hidden border-2 transition-all duration-200 aspect-square',
                    isSelected
                      ? 'border-crusader-gold shadow-glow-gold scale-105'
                      : 'border-crusader-gold/20 hover:border-crusader-gold/60 hover:scale-105',
                  )}
                >
                  <div className="w-full h-full pointer-events-none scale-150 origin-center">
                    <FlagAvatar flagId={flagId} size={100} className="w-full h-full border-none rounded-none" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Upload Custom (still available) */}
        <div className="relative mt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <button
            onClick={() => canUploadAvatar && fileRef.current?.click()}
            disabled={!canUploadAvatar || uploading}
            className={cn(
              'w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-dashed font-cinzel text-sm font-semibold tracking-wider transition-all',
              canUploadAvatar
                ? 'border-crusader-gold/30 text-crusader-gold/60 hover:border-crusader-gold hover:text-crusader-gold cursor-pointer'
                : 'border-crusader-gold/10 text-crusader-gold/20 cursor-not-allowed',
            )}
          >
            {canUploadAvatar ? (
              uploading ? (
                <><div className="w-4 h-4 border-2 border-crusader-gold border-t-transparent rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={16} /> Upload Custom Portrait</>
              )
            ) : (
              <><Lock size={14} /> Custom Upload unlocks at Level 5</>
            )}
          </button>
        </div>

        {/* Current avatar preview */}
        {selectedAvatar && (
          <div className="flex items-center gap-4 p-4 mt-4 bg-crusader-dark/50 rounded-xl border border-crusader-gold/10">
            <FlagAvatar 
              flagId={selectedAvatar} 
              size={56} 
              fallbackLetter={player.username[0]} 
              fallbackColor={player.default_color} 
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-crusader-gold font-cinzel font-semibold">Selected Banner</p>
              <p className="text-xs text-crusader-gold/40 truncate">{selectedAvatar.startsWith('flag:') ? 'Medieval Flag' : 'Custom Upload'}</p>
            </div>
            <button onClick={() => setAvatar('')} className="p-2 text-crusader-gold/40 hover:text-crusader-gold hover:bg-crusader-gold/10 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
      </Card>

      {/* Default Color */}
      <Card className="p-6 space-y-4">
        <h2 className="font-cinzel text-lg font-bold text-crusader-gold flex items-center gap-2">
          <Shield size={16} /> Default Army Color
        </h2>
        <p className="text-xs text-crusader-gold/40">This color is used when you join a game before assignments are made.</p>
        <div className="flex items-center gap-4 flex-wrap">
          {PLAYER_COLORS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setColor(value)}
              title={label}
              className={cn(
                'w-10 h-10 rounded-full border-4 transition-all duration-200',
                selectedColor === value
                  ? 'scale-125 shadow-[0_0_12px_4px]'
                  : 'border-transparent hover:scale-110',
              )}
              style={{
                backgroundColor: value,
                borderColor: selectedColor === value ? value : 'transparent',
                boxShadow: selectedColor === value ? `0 0 12px 4px ${value}66` : undefined,
              }}
            />
          ))}
        </div>
        <p className="text-xs font-cinzel" style={{ color: selectedColor }}>
          {PLAYER_COLORS.find((c) => c.value === selectedColor)?.label ?? ''} selected
        </p>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!!usernameError || checking}
          size="lg"
          icon={saved ? <Check size={16} /> : undefined}
          className={saved ? 'bg-green-700 border-green-500' : ''}
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
        {usernameError && (
          <p className="text-xs text-crusader-crimson-bright flex items-center gap-1">
            <AlertCircle size={12} /> {usernameError}
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Progression
// ═══════════════════════════════════════════════════════════════════════════════

function ProgressionTab() {
  const player = useAppStore((s) => s.player)!
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [loading, setLoading] = useState(true)

  const { level, currentLevelXp, nextLevelXp, progress } = computeLevelProgress(player.xp)
  const tier = getTierForLevel(level)

  useEffect(() => {
    getSupabaseClient()
      .from('player_achievements')
      .select('*, achievements(*)')
      .eq('player_id', player.id)
      .then(({ data }) => {
        if (data) setAchievements(data as any)
        setLoading(false)
      })
  }, [player.id])

  const unlockedIds = new Set(achievements.map((a) => a.achievement_id))

  return (
    <div className="space-y-10">

      {/* XP Progress Hero */}
      <Card className="p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ background: `radial-gradient(circle at 20% 50%, ${tier.color} 0%, transparent 60%)` }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="text-center">
            <div
              className="font-cinzel text-7xl font-black leading-none"
              style={{ color: tier.color, textShadow: `0 0 30px ${tier.color}88` }}
            >
              {level}
            </div>
            <div className="font-cinzel text-sm font-bold mt-1" style={{ color: tier.color }}>{tier.title}</div>
          </div>
          <div className="flex-1 space-y-3 w-full">
            <div className="flex justify-between items-baseline">
              <span className="font-cinzel text-sm text-crusader-gold">Level Progress</span>
              {level < MAX_LEVEL ? (
                <span className="text-sm text-crusader-gold/50">{currentLevelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
              ) : (
                <span className="text-sm text-crusader-gold">MAX LEVEL REACHED</span>
              )}
            </div>
            <div className="h-4 rounded-full bg-crusader-dark border border-crusader-gold/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full relative"
                style={{ background: `linear-gradient(90deg, ${tier.color}66, ${tier.color})` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse-slow rounded-full" />
              </motion.div>
            </div>
            <div className="flex justify-between text-xs text-crusader-gold/30 font-cinzel">
              <span>Total XP: {player.xp.toLocaleString()}</span>
              {level < MAX_LEVEL && <span>Next level in {(nextLevelXp - currentLevelXp).toLocaleString()} XP</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Level Milestones */}
      <div>
        <h2 className="font-cinzel text-xl font-bold text-crusader-gold mb-6">Level Milestones</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-[2px] bg-gradient-to-b from-crusader-gold/40 via-crusader-gold/20 to-transparent" />

          <div className="space-y-4">
            {LEVEL_UNLOCKS.map((unlock) => {
              const reached = level >= unlock.level
              const unlockTier = getTierForLevel(unlock.level)
              return (
                <div key={unlock.level} className="flex items-start gap-5">
                  {/* Node */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 relative z-10 transition-all duration-300',
                      reached
                        ? 'border-current shadow-md'
                        : 'border-crusader-gold/15 bg-crusader-dark opacity-50',
                    )}
                    style={reached ? {
                      borderColor: unlockTier.color,
                      backgroundColor: unlockTier.color + '22',
                      boxShadow: `0 0 12px ${unlockTier.color}44`,
                    } : undefined}
                  >
                    {reached ? unlock.icon : <Lock size={14} className="text-crusader-gold/30" />}
                  </div>

                  <Card className={cn('flex-1 p-4 transition-all duration-300', !reached && 'opacity-40')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded"
                            style={reached ? { color: unlockTier.color, backgroundColor: unlockTier.color + '22' } : { color: '#666' }}
                          >
                            LV {unlock.level}
                          </span>
                          <span className={cn(
                            'text-[10px] font-cinzel uppercase tracking-wider px-1.5 py-0.5 rounded',
                            unlock.type === 'title'    && 'bg-yellow-900/50 text-yellow-400',
                            unlock.type === 'feature'  && 'bg-blue-900/50 text-blue-400',
                            unlock.type === 'cosmetic' && 'bg-purple-900/50 text-purple-400',
                            unlock.type === 'frame'    && 'bg-green-900/50 text-green-400',
                          )}>
                            {unlock.type}
                          </span>
                        </div>
                        <p className={cn('font-cinzel text-sm font-bold', reached ? 'text-crusader-gold' : 'text-crusader-gold/40')}>
                          {unlock.title}
                        </p>
                        <p className="text-xs text-crusader-gold/40 mt-0.5">{unlock.description}</p>
                      </div>
                      {reached && <Check size={16} className="text-green-400 flex-shrink-0 mt-1" />}
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h2 className="font-cinzel text-xl font-bold text-crusader-gold mb-6">Achievements</h2>
        {loading
          ? <SkeletonList count={6} />
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ACHIEVEMENTS.map((def) => {
                const unlocked = unlockedIds.has(def.id)
                return (
                  <Card
                    key={def.id}
                    className={cn('p-4 flex items-start gap-4 transition-all duration-300', !unlocked && 'opacity-40')}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border',
                        unlocked ? 'border-crusader-gold/30 bg-crusader-gold/10' : 'border-crusader-gold/10 bg-crusader-dark',
                      )}
                    >
                      {unlocked ? def.icon : <Lock size={16} className="text-crusader-gold/30" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('font-cinzel text-sm font-bold truncate', unlocked ? 'text-crusader-gold' : 'text-crusader-gold/30')}>
                        {def.name}
                      </p>
                      <p className="text-xs text-crusader-gold/40 mt-0.5 leading-relaxed">{def.description}</p>
                      <p className="text-xs mt-1.5 font-cinzel" style={{ color: unlocked ? '#C9A84C' : '#555' }}>
                        +{def.xp_reward} XP
                      </p>
                    </div>
                    {unlocked && <Check size={14} className="text-green-400 flex-shrink-0 mt-1 ml-auto" />}
                  </Card>
                )
              })}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: History
// ═══════════════════════════════════════════════════════════════════════════════

function HistoryTab() {
  const player = useAppStore((s) => s.player)!
  const [history, setHistory] = useState<GameHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('game_players')
        .select('id, game_id, is_eliminated, joined_at, games(id, name, mode, winner_id, created_at, updated_at, battle_maps(name))')
        .eq('player_id', player.id)
        .order('joined_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (data) {
        setHistory(data.map((gp: any) => ({
          id: gp.id,
          game_id: gp.game_id,
          game_name: gp.games?.name ?? 'Unknown',
          map_name: gp.games?.battle_maps?.name ?? '',
          mode: gp.games?.mode ?? '',
          result: gp.games?.winner_id === player.id
            ? 'victory'
            : gp.is_eliminated
              ? 'eliminated'
              : 'defeat',
          date: gp.games?.updated_at ?? gp.joined_at,
          players: 0,
        })))
      }
      setLoading(false)
    }
    load()
  }, [player.id, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-xl font-bold text-crusader-gold">Battle History</h2>
        <span className="text-sm text-crusader-gold/40 font-cinzel">
          {player.games_played} total games
        </span>
      </div>

      {loading
        ? <SkeletonList count={8} />
        : history.length === 0
          ? <EmptyState icon={Sword} message="No battle history yet." />
          : (
            <Card className="divide-y divide-crusader-gold/10">
              {history.map((g) => <GameRow key={g.id} game={g} detailed />)}
            </Card>
          )
      }

      {history.length === PAGE_SIZE && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Maps
// ═══════════════════════════════════════════════════════════════════════════════

function MapsTab() {
  const player = useAppStore((s) => s.player)!
  const [maps, setMaps]       = useState<UserMap[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabaseClient()
      .from('battle_maps')
      .select('id, name, region_name, territories, play_count, is_public, created_at')
      .eq('author_id', player.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setMaps(data.map((m: any) => ({
            ...m,
            territory_count: Array.isArray(m.territories) ? m.territories.length : 0,
          })))
        }
        setLoading(false)
      })
  }, [player.id])

  async function togglePublic(mapId: string, currentVal: boolean) {
    const supabase = getSupabaseClient()
    await supabase.from('battle_maps').update({ is_public: !currentVal }).eq('id', mapId)
    setMaps((prev) => prev.map((m) => m.id === mapId ? { ...m, is_public: !currentVal } : m))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-xl font-bold text-crusader-gold">My Maps</h2>
        <a href="/map-creator">
          <Button size="sm" icon={<Map size={14} />}>Create Map</Button>
        </a>
      </div>

      {loading
        ? <SkeletonList count={4} />
        : maps.length === 0
          ? (
            <EmptyState icon={Map} message="No maps created yet. Build your first battlefield!">
              <a href="/map-creator">
                <Button variant="outline" size="sm" className="mt-4">Open Map Creator</Button>
              </a>
            </EmptyState>
          )
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {maps.map((m) => (
                <Card key={m.id} hover glow="gold" className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-cinzel font-bold text-crusader-gold truncate">{m.name}</p>
                      <p className="text-xs text-crusader-gold/40 mt-0.5">{m.region_name}</p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-cinzel font-bold px-2 py-0.5 rounded-full border flex-shrink-0',
                        m.is_public
                          ? 'text-green-400 border-green-500/30 bg-green-900/20'
                          : 'text-crusader-gold/40 border-crusader-gold/20 bg-crusader-dark',
                      )}
                    >
                      {m.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>

                  <div className="flex gap-4 text-xs text-crusader-gold/50">
                    <span className="flex items-center gap-1.5">
                      <Map size={11} /> {m.territory_count} territories
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sword size={11} /> {m.play_count} plays
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[10px]"
                      onClick={() => togglePublic(m.id, m.is_public)}
                    >
                      {m.is_public ? 'Make Private' : 'Publish'}
                    </Button>
                    <a href={`/map-creator?edit=${m.id}`} className="flex-1">
                      <Button size="sm" variant="ghost" className="w-full text-[10px]">Edit</Button>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )
      }
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function GameRow({ game, detailed = false }: { game: GameHistoryRow; detailed?: boolean }) {
  const resultColor = game.result === 'victory'
    ? 'text-green-400 bg-green-900/20 border-green-500/20'
    : game.result === 'eliminated'
      ? 'text-orange-400 bg-orange-900/20 border-orange-500/20'
      : 'text-crusader-crimson-bright bg-crusader-crimson/10 border-crusader-crimson/20'

  const modeLabel = game.mode === 'lightning' ? '⚡ Lightning' : game.mode === 'slow_hour' ? '⏱ Hourly' : '📅 Daily'

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5',
        game.result === 'victory' ? 'bg-green-400' : game.result === 'eliminated' ? 'bg-orange-400' : 'bg-crusader-crimson-bright'
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-crusader-gold-light/80 truncate font-medium font-cinzel">{game.game_name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {detailed && game.map_name && (
            <span className="text-xs text-crusader-gold/30 flex items-center gap-1"><Map size={9} />{game.map_name}</span>
          )}
          {game.mode && (
            <span className="text-xs text-crusader-gold/30">{modeLabel}</span>
          )}
          {game.date && (
            <span className="text-xs text-crusader-gold/20">
              {new Date(game.date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <span className={cn('text-[10px] font-cinzel font-bold uppercase px-2 py-1 rounded border', resultColor)}>
        {game.result === 'victory' ? 'Victory' : game.result === 'eliminated' ? 'Eliminated' : 'Defeat'}
      </span>
    </div>
  )
}

function MapCard({ map }: { map: UserMap }) {
  return (
    <Card hover glow="gold" className="p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-cinzel text-sm font-semibold text-crusader-gold truncate">{map.name}</p>
          <p className="text-xs text-crusader-gold/40 mt-0.5">
            {map.territory_count} territories · {map.play_count} plays
          </p>
        </div>
        <Map size={16} className="text-crusader-gold/30 flex-shrink-0" />
      </div>
    </Card>
  )
}

function SectionHeader({
  title, href, hrefLabel, onClick,
}: {
  title: string; href?: string; hrefLabel?: string; onClick?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-1">
      <h2 className="font-cinzel text-lg font-semibold text-crusader-gold">{title}</h2>
      {href && hrefLabel && (
        <a href={href} className="text-xs text-crusader-gold/50 hover:text-crusader-gold flex items-center gap-1 transition-colors">
          {hrefLabel} <ChevronRight size={12} />
        </a>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, message, children }: { icon: typeof Sword; message: string; children?: React.ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <Icon size={32} className="text-crusader-gold/20 mx-auto mb-3" />
      <p className="text-sm text-crusader-gold/40">{message}</p>
      {children}
    </Card>
  )
}

function SkeletonList({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-crusader-dark/60 animate-pulse border border-crusader-gold/5" />
      ))}
    </div>
  )
}
