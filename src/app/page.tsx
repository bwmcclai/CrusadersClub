import dynamic from 'next/dynamic'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Sword, Map, Users, Zap, Globe, Shield, Trophy, ChevronRight, Star } from 'lucide-react'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-32 h-32 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
    </div>
  ),
})

// ─── Feature Cards ────────────────────────────────────────────────────────────
const features = [
  {
    icon: Globe,
    title: 'World Map Creator',
    desc: 'Pick any region on Earth — continent, country, or custom zone. Auto-generate territories and share your map with the community.',
    color: 'text-crusader-glow',
  },
  {
    icon: Zap,
    title: 'Lightning Battles',
    desc: '1-minute turns, fast-paced combat. No time for hesitation — plan your offensive and strike hard.',
    color: 'text-crusader-gold',
  },
  {
    icon: Users,
    title: 'Multiplayer & AI',
    desc: 'Challenge friends, strangers, or battle-hardened AI opponents at any skill level.',
    color: 'text-crusader-crimson-bright',
  },
  {
    icon: Shield,
    title: 'Slow Diplomacy',
    desc: '1-hour or 1-day turns for deep strategic play. Form alliances, break them, and rewrite history.',
    color: 'text-crusader-gold',
  },
]

const stats = [
  { value: '10K+', label: 'Players' },
  { value: '500+', label: 'Maps' },
  { value: '50K+', label: 'Battles' },
  { value: '99.9%', label: 'Uptime' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-crusader-void overflow-hidden">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative h-screen flex items-center">
        {/* Globe background */}
        <div className="absolute inset-0 z-0">
          <EarthGlobe autoRotate interactive={false} className="w-full h-full" />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-crusader-void via-crusader-void/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-crusader-void via-transparent to-crusader-void/60" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-crusader-gold/30 bg-crusader-gold/10 mb-6">
              <Star size={12} className="text-crusader-gold fill-crusader-gold" />
              <span className="text-xs font-cinzel tracking-widest text-crusader-gold uppercase">
                The Modern Strategy Game
              </span>
            </div>

            {/* Title */}
            <h1 className="font-cinzel font-black leading-tight mb-6">
              <span className="block text-5xl sm:text-7xl text-white glow-white">
                CRUSADERS
              </span>
              <span className="block text-5xl sm:text-7xl shimmer">
                CLUB
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-crusader-gold-light/70 mb-8 leading-relaxed max-w-xl">
              Command armies. Conquer continents. Build legendary maps and
              battle players across the globe in real-time or slow-burn strategy.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/lobby">
                <Button size="xl" variant="gold" icon={<Sword size={20} />}>
                  Start Playing
                </Button>
              </Link>
              <Link href="/map-creator">
                <Button size="xl" variant="outline" icon={<Map size={20} />}>
                  Create a Map
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float">
          <span className="text-xs font-cinzel tracking-widest text-crusader-gold/40 uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-crusader-gold/40 to-transparent" />
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-8 border-y border-crusader-gold/10 bg-crusader-navy/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold">{value}</div>
                <div className="text-sm text-crusader-gold-light/50 mt-1 font-medium tracking-wide uppercase">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-cinzel text-4xl font-bold text-crusader-gold mb-4 glow-gold">
              Built for Glory
            </h2>
            <p className="text-crusader-gold-light/60 text-lg max-w-xl mx-auto">
              Everything you need for epic strategic battles, beautifully crafted.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <Card key={title} hover glow="gold" className="p-8 group">
                <div className={`w-12 h-12 rounded-xl bg-crusader-navy flex items-center justify-center mb-5 group-hover:scale-110 transition-transform ${color}`}>
                  <Icon size={24} />
                </div>
                <h3 className="font-cinzel text-xl font-semibold text-crusader-gold mb-3">{title}</h3>
                <p className="text-crusader-gold-light/60 leading-relaxed">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to Play ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-crusader-navy/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-cinzel text-4xl font-bold text-crusader-gold mb-4 glow-gold">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Choose Your Battle', desc: 'Browse community maps or create your own from the interactive world globe.' },
              { step: '02', title: 'Assemble Your Forces', desc: 'Set up a game with friends or matchmake against global opponents and AI.' },
              { step: '03', title: 'Conquer & Reign', desc: 'Deploy armies, attack territories, and outlast every other commander.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="font-cinzel text-6xl font-black text-crusader-gold/10 mb-4 leading-none">{step}</div>
                <h3 className="font-cinzel text-xl font-semibold text-crusader-gold mb-3">{title}</h3>
                <p className="text-crusader-gold-light/60 leading-relaxed">{desc}</p>
                <div className="absolute top-8 -right-4 hidden md:block last:hidden">
                  <ChevronRight size={20} className="text-crusader-gold/30" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Game Modes ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-cinzel text-4xl font-bold text-crusader-gold mb-4 glow-gold">
              Choose Your Pace
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Lightning */}
            <Card glow="gold" className="p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-crusader-gold/5 rounded-bl-full" />
              <Zap size={40} className="text-crusader-gold mb-5" />
              <h3 className="font-cinzel text-2xl font-bold text-crusader-gold mb-3">⚡ Lightning</h3>
              <p className="text-crusader-gold-light/60 mb-5 leading-relaxed">
                1 minute per turn. Fast-paced, intense battles where every second counts.
                Perfect for quick sessions or competitive play.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Fast-paced', 'Competitive', '30-90 min games'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-crusader-gold/10 text-crusader-gold text-xs font-medium border border-crusader-gold/20">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>

            {/* Slow */}
            <Card glow="blue" className="p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-crusader-glow/5 rounded-bl-full" />
              <Shield size={40} className="text-crusader-glow mb-5" />
              <h3 className="font-cinzel text-2xl font-bold text-crusader-glow mb-3">⏱ Slow & Strategic</h3>
              <p className="text-crusader-gold-light/60 mb-5 leading-relaxed">
                1 hour or 1 day per turn. Deep diplomacy, long-term planning, and epic
                multi-week campaigns across vast maps.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Deep strategy', 'Diplomatic', 'Days-long epics'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-crusader-glow/10 text-crusader-glow text-xs font-medium border border-crusader-glow/20">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold opacity-50" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-cinzel text-4xl sm:text-5xl font-black text-crusader-gold glow-gold mb-6">
            Your Conquest Awaits
          </h2>
          <p className="text-xl text-crusader-gold-light/60 mb-10 leading-relaxed">
            Join thousands of commanders already battling for supremacy. Free to play.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/register">
              <Button size="xl" variant="gold" icon={<Sword size={20} />}>
                Create Free Account
              </Button>
            </Link>
            <Link href="/lobby">
              <Button size="xl" variant="outline">
                Browse Open Games
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-crusader-gold/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Sword size={20} className="text-crusader-gold" />
              <span className="font-cinzel font-bold text-lg tracking-widest text-crusader-gold">
                CRUSADERS CLUB
              </span>
            </div>
            <p className="text-crusader-gold-light/30 text-sm">
              © 2025 Crusaders Club. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-crusader-gold-light/40">
              <a href="#" className="hover:text-crusader-gold transition-colors">Privacy</a>
              <a href="#" className="hover:text-crusader-gold transition-colors">Terms</a>
              <a href="#" className="hover:text-crusader-gold transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
