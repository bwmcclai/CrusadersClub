import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  Sword, Map, Trophy, TrendingUp, Clock,
  Zap, Shield, ChevronRight, Plus, Users,
} from 'lucide-react'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockPlayer = {
  username: 'IronCrusader',
  elo: 1847,
  games_played: 142,
  games_won: 89,
  rank: 'Marshal',
}

const mockActiveGames = [
  { id: '1', name: 'European Theatre', map: 'Europe Classic', mode: 'lightning', yourTurn: true,  turnDeadline: '0:43 remaining', players: 4 },
  { id: '2', name: 'Pacific Campaign', map: 'Pacific Islands',mode: 'slow_day',  yourTurn: false, turnDeadline: '18h remaining',  players: 3 },
  { id: '3', name: 'Desert War',       map: 'Africa Sands',   mode: 'slow_hour', yourTurn: true,  turnDeadline: '22 min',          players: 6 },
]

const mockRecentGames = [
  { id: 'r1', name: 'Battle of Rhine',    result: 'victory', mode: 'lightning', date: '2h ago', duration: '45 min' },
  { id: 'r2', name: 'Siberian Conquest',  result: 'defeat',  mode: 'slow_day',  date: '1d ago', duration: '5 days' },
  { id: 'r3', name: 'Island Hopping',     result: 'victory', mode: 'lightning', date: '2d ago', duration: '1h 12m' },
]

const mockMaps = [
  { id: 'm1', name: 'Rhine Valley',   territories: 12, plays: 48  },
  { id: 'm2', name: 'Nordic Fjords',  territories: 18, plays: 127 },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const winRate = Math.round((mockPlayer.games_won / mockPlayer.games_played) * 100)

  return (
    <div className="min-h-screen bg-crusader-void">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-crusader-gold/60 text-sm font-cinzel tracking-widest uppercase mb-1">Dashboard</p>
            <h1 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold">
              Welcome back, {mockPlayer.username}
            </h1>
            <p className="text-crusader-gold-light/40 text-sm mt-1">
              Rank: <span className="text-crusader-gold">{mockPlayer.rank}</span>
              {' '}· ELO: <span className="text-crusader-gold">{mockPlayer.elo}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/lobby">
              <Button icon={<Sword size={16} />}>Find Game</Button>
            </Link>
            <Link href="/map-creator">
              <Button variant="outline" icon={<Plus size={16} />}>New Map</Button>
            </Link>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Games Played', value: mockPlayer.games_played, icon: Sword,      color: 'text-crusader-gold' },
            { label: 'Victories',    value: mockPlayer.games_won,    icon: Trophy,     color: 'text-yellow-400'    },
            { label: 'Win Rate',     value: `${winRate}%`,           icon: TrendingUp, color: 'text-green-400'     },
            { label: 'ELO Rating',   value: mockPlayer.elo,          icon: Shield,     color: 'text-crusader-glow' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={16} className={color} />
                <span className="text-xs text-crusader-gold/50 font-medium uppercase tracking-wide">{label}</span>
              </div>
              <div className={`font-cinzel text-2xl font-bold ${color}`}>{value}</div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Active Games ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-cinzel text-lg font-semibold text-crusader-gold">Active Battles</h2>
              <Link href="/lobby" className="text-xs text-crusader-gold/50 hover:text-crusader-gold flex items-center gap-1">
                All games <ChevronRight size={12} />
              </Link>
            </div>

            {mockActiveGames.map((game) => (
              <Card key={game.id} hover glow="gold" className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {game.yourTurn && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-crusader-gold/20 text-crusader-gold text-xs font-medium border border-crusader-gold/30 animate-pulse-slow">
                          Your Turn
                        </span>
                      )}
                      <span className={`text-xs ${game.mode === 'lightning' ? 'text-crusader-gold' : 'text-crusader-glow'}`}>
                        {game.mode === 'lightning' ? '⚡ Lightning' : game.mode === 'slow_hour' ? '⏱ Slow' : '📅 Slow'}
                      </span>
                    </div>
                    <h3 className="font-cinzel font-semibold text-crusader-gold-light truncate">{game.name}</h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-crusader-gold/40">
                      <span className="flex items-center gap-1"><Map size={11} /> {game.map}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {game.players} players</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {game.turnDeadline}</span>
                    </div>
                  </div>
                  <Link href={`/game/${game.id}`}>
                    <Button size="sm" variant={game.yourTurn ? 'gold' : 'outline'}>
                      {game.yourTurn ? 'Attack!' : 'Watch'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Recent results */}
            <div>
              <h2 className="font-cinzel text-lg font-semibold text-crusader-gold mb-4">Recent Battles</h2>
              <Card className="divide-y divide-crusader-gold/10">
                {mockRecentGames.map((game) => (
                  <div key={game.id} className="flex items-center gap-3 px-5 py-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${game.result === 'victory' ? 'bg-green-400' : 'bg-crusader-crimson-bright'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-crusader-gold-light/80 truncate font-medium">{game.name}</p>
                      <p className="text-xs text-crusader-gold/30 mt-0.5">{game.date} · {game.duration}</p>
                    </div>
                    <span className={`text-xs font-semibold uppercase ${game.result === 'victory' ? 'text-green-400' : 'text-crusader-crimson-bright'}`}>
                      {game.result === 'victory' ? 'Win' : 'Loss'}
                    </span>
                  </div>
                ))}
              </Card>
            </div>

            {/* My Maps */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-cinzel text-lg font-semibold text-crusader-gold">My Maps</h2>
                <Link href="/map-creator">
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />}>New</Button>
                </Link>
              </div>
              <div className="space-y-3">
                {mockMaps.map((map) => (
                  <Card key={map.id} hover glow="gold" className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-cinzel text-sm font-semibold text-crusader-gold">{map.name}</p>
                        <p className="text-xs text-crusader-gold/40 mt-0.5">{map.territories} territories · {map.plays} plays</p>
                      </div>
                      <Map size={16} className="text-crusader-gold/40" />
                    </div>
                  </Card>
                ))}
                {mockMaps.length === 0 && (
                  <p className="text-sm text-crusader-gold/30 text-center py-6">No maps yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
