'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ParticleBackground from '@/components/ui/ParticleBackground'
import { Sword, Map, Users, Zap, Globe, Shield, Trophy, ChevronRight, Star } from 'lucide-react'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-32 h-32 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
    </div>
  ),
})

const features = [
  { icon: Globe, title: 'World Map Creator', desc: 'Pick any region on Earth. Auto-generate territories and share your map.', color: 'text-crusader-glow' },
  { icon: Zap, title: 'Lightning Battles', desc: '1-minute turns, fast-paced combat. Strike hard and fast.', color: 'text-crusader-gold' },
  { icon: Users, title: 'Multiplayer & AI', desc: 'Challenge friends or battle-hardened AI opponents at any skill level.', color: 'text-crusader-crimson-bright' },
  { icon: Shield, title: 'Slow Diplomacy', desc: '1-hour or 1-day turns for deep strategic play. Rewrite history.', color: 'text-crusader-gold' },
]

const stats = [
  { value: '10K+', label: 'Players' },
  { value: '500+', label: 'Maps' },
  { value: '50K+', label: 'Battles' },
  { value: '99.9%', label: 'Uptime' },
]

const fadeInUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-crusader-void overflow-hidden selection:bg-crusader-gold/30">
      {/* Main UI only becomes visible/interactive after splash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10"
      >
        <Navbar />

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative h-screen flex items-center">
          {/* Backgrounds */}
          <div className="absolute inset-0 z-0">
            <ParticleBackground />
            <div className="absolute inset-0 opacity-50 mix-blend-screen mix-blend-mode">
              <EarthGlobe autoRotate interactive={false} className="w-full h-full" />
            </div>
            {/* Cinematic Gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-crusader-void via-crusader-void/80 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-crusader-void via-transparent to-crusader-void/80 z-10" />
          </div>

          <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="max-w-2xl"
            >

              <div className="relative z-10 py-10">
                <motion.div variants={fadeInUp} className="relative mb-12">
                  {/* Epic Logo Container */}
                  <div className="relative flex items-center justify-center">
                    {/* The Logo */}
                    <img
                      src="/CrusadersClub_LOGO.png"
                      alt="Crusaders Club"
                      className="relative z-10 w-full max-w-[550px] h-auto drop-shadow-[0_0_40px_rgba(201,168,76,0.15)] group-hover:scale-[1.02] transition-transform duration-700"
                    />
                  </div>
                </motion.div>

                <motion.div variants={fadeInUp} className="mb-12 text-center md:text-left">
                  <h1 className="font-cinzel text-3xl sm:text-5xl font-black tracking-[0.3em] text-crusader-gold-light uppercase italic cursor-default">
                    Command the World
                  </h1>
                </motion.div>

                <motion.div variants={fadeInUp} className="flex flex-wrap gap-6 relative z-30">
                  <Link href="/lobby">
                    <Button size="xl" variant="gold" icon={<Sword size={24} />} className="shadow-[0_0_40px_rgba(201,168,76,0.3)] px-12 border-2">
                      Start Playing
                    </Button>
                  </Link>
                  <Link href="/map-creator">
                    <Button size="xl" variant="outline" icon={<Map size={24} />} className="px-12 border-2 hover:bg-crusader-gold/10">
                      Map Creator
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float z-20"
          >
            <span className="text-xs font-cinzel tracking-widest text-crusader-gold/40 uppercase">Initialize</span>
            <div className="w-px h-8 bg-gradient-to-b from-crusader-gold/40 to-transparent" />
          </motion.div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
        <section className="relative z-20 py-10 border-y border-white/5 glass-dark backdrop-blur-3xl">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={staggerContainer}
              className="grid grid-cols-2 md:grid-cols-4 gap-8"
            >
              {stats.map(({ value, label }) => (
                <motion.div key={label} variants={fadeInUp} className="text-center group">
                  <div className="font-cinzel text-4xl font-black text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{value}</div>
                  <div className="text-sm text-crusader-gold mt-2 font-bold tracking-widest uppercase">{label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section className="py-32 px-6 relative z-10">
          <div className="absolute inset-0 bg-radial-glow opacity-20 pointer-events-none" />
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="text-center mb-20"
            >
              <h2 className="font-cinzel text-5xl font-black text-white mb-6 drop-shadow-2xl">Forged for <span className="text-crusader-gold glow-gold">Glory</span></h2>
              <p className="text-crusader-gold-light/60 text-lg max-w-2xl mx-auto">
                Next-generation web technology powers an uncompromised tactical warfare experience right in your browser.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 gap-8"
            >
              {features.map(({ icon: Icon, title, desc, color }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card hover glow="gold" className="p-8 h-full glass-deep isolate overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-crusader-gold/5 blur-3xl rounded-full transform translate-x-1/2 -translate-y-1/2 group-hover:bg-crusader-gold/10 transition-colors duration-500" />
                    <div className={`w-14 h-14 rounded-2xl glass flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ${color} shadow-lg relative z-10`}>
                      <Icon size={28} />
                    </div>
                    <h3 className="font-cinzel text-2xl font-bold text-white mb-4 relative z-10">{title}</h3>
                    <p className="text-crusader-gold-light/60 leading-relaxed text-lg relative z-10">{desc}</p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-32 px-6 relative z-10 overflow-hidden border-t border-white/5 glass-dark">
          <div className="absolute inset-0 bg-radial-gold opacity-40 pointer-events-none" />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="relative max-w-4xl mx-auto text-center z-10"
          >
            <motion.h2 variants={fadeInUp} className="font-cinzel text-5xl sm:text-7xl font-black text-white drop-shadow-2xl mb-8">
              Your Conquest <span className="text-crusader-gold glow-gold">Awaits</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-crusader-gold-light/70 mb-12 flex items-center justify-center gap-4">
              <span className="h-px w-12 bg-crusader-gold/30" />
              Join the elite commanders. Free to play.
              <span className="h-px w-12 bg-crusader-gold/30" />
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-6">
              <Link href="/auth/register">
                <Button size="xl" variant="gold" icon={<Sword size={24} />} className="text-xl px-12 py-5 shadow-[0_0_40px_rgba(201,168,76,0.5)]">Deploy Now</Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/10 py-12 px-6 glass-deep relative z-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src="/CrusadersClub_LOGO.png" alt="Logo" className="w-8 h-8 opacity-80 mix-blend-screen" />
              <span className="font-cinzel font-bold text-xl tracking-widest text-white/50">CRUSADERS CLUB</span>
            </div>
            <p className="text-crusader-gold-light/30 text-sm">© 2026 Crusaders Club. All rights reserved.</p>
          </div>
        </footer>
      </motion.div>
    </div>
  )
}
