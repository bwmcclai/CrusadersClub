'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Users, Sword, Trophy } from 'lucide-react'

import { getSupabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { getTierForLevel } from '@/lib/xp'

export default function LandingPage() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [latency, setLatency] = useState(24)
  const player = useAppStore((s) => s.player)
  const router = useRouter()
  const tier = player ? getTierForLevel(player.level) : null


  const menuItems = [
    { id: 'campaign', label: 'Start / Continue Campaign', icon: Map, href: '/campaign' },
    { id: 'find', label: 'Start or Find a Match', icon: Users, href: '/lobby' },
    { id: 'start', label: 'Maps', icon: Sword, href: '/map-creator' },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy, href: '/leaderboard' },
  ]

  const carouselItems = [
    { id: 1, title: 'Global Warfare',       subtitle: 'DOMINATE THE WORLD',    image: '/showcase/carousel_1.png' },
    { id: 2, title: 'Tactical Combat',      subtitle: 'FAST PACED STRATEGY',   image: '/showcase/carousel_2.png' },
    { id: 3, title: 'Command Your Forces',  subtitle: 'LEAD TO GLORY',         image: '/showcase/carousel_3.png' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselItems.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [carouselItems.length])

  return (
    <div className="h-screen w-screen bg-crusader-void overflow-hidden text-crusader-parchment font-inter selection:bg-crusader-gold/30 relative">

      {/* ── Background ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 pointer-events-none bg-crusader-wood-dark">
          <img
            src="/Background.png"
            alt="Background"
            className="w-full h-full object-cover object-[15%_15%] md:object-[15%_10%] opacity-[0.9] transition-opacity duration-1000 transform scale-[2.2] translate-x-[-20%] md:scale-[1.02] md:translate-x-[2%] translate-y-[15%] md:translate-y-[2%] filter sepia-[0.4] brightness-75 contrast-110"
          />
        </div>

        {/* Dark vignette for medieval atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="relative z-40 h-full flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 pt-20 pb-12">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex-shrink-0"
        >
          <img
            src="/CrusadersClub_LOGO.png"
            alt="Crusaders Club"
            className="h-14 sm:h-16 md:h-20 w-auto drop-shadow-[0_0_50px_rgba(139,26,26,0.6)]"
          />
        </motion.div>

        {/* Carousel Widget */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.35 }}
          className="relative w-full max-w-lg xl:max-w-xl flex-shrink-0 md:self-end md:mr-10 xl:mr-20"
          style={{ height: 'clamp(260px, 44vh, 480px)' }}
        >
          {/* Complex Diegetic Frame Structure */}
          <div className="absolute inset-0 border-[3px] border-crusader-wood-dark bg-crusader-void/80 backdrop-blur-md overflow-hidden shadow-[0_15px_60px_rgba(0,0,0,1)] pointer-events-auto rounded-sm group">

            {/* Inner Gold border */}
            <div className="absolute inset-1 border border-crusader-gold/40 z-30 pointer-events-none" />

            {/* Title bar */}
            <div className="absolute top-0 left-0 w-full h-10 bg-gradient-to-b from-crusader-wood-dark to-crusader-void flex items-center justify-center z-30 border-b-2 border-crusader-gold/30">
              <div className="text-xs font-cinzel font-bold tracking-[0.2em] text-crusader-parchment uppercase drop-shadow-md">
                Realm Chronicles
              </div>
            </div>

            {/* Slide container */}
            <div className="absolute top-10 bottom-0 left-0 right-0 z-10 p-2">
              <div className="relative w-full h-full overflow-hidden border border-black/50">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    className="absolute inset-0"
                  >
                    <img
                      src={carouselItems[activeSlide].image}
                      alt={carouselItems[activeSlide].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  </motion.div>
                </AnimatePresence>

                {/* Text overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 z-20 flex flex-col items-center text-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSlide}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="border-b border-crusader-gold/50 px-4 py-1 mb-2 inline-block">
                        <p className="text-crusader-gold text-[10px] font-bold tracking-[0.3em] uppercase">
                          {carouselItems[activeSlide].subtitle}
                        </p>
                      </div>
                      <h3 className="font-cinzel text-xl sm:text-2xl xl:text-3xl font-black text-crusader-parchment uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-tight">
                        {carouselItems[activeSlide].title}
                      </h3>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div className="absolute bottom-5 left-0 right-0 z-30 flex justify-center gap-3">
              {carouselItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`w-2 transition-all duration-500 rounded-full ${
                    activeSlide === i
                      ? 'h-2 bg-crusader-gold shadow-[0_0_10px_rgba(201,168,76,1)]'
                      : 'h-2 bg-white/20 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            {/* Corner accents */}
            <div className="absolute top-12 right-3 w-6 h-6 border-t-2 border-r-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute top-12 left-3 w-6 h-6 border-t-2 border-l-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-crusader-gold/60 pointer-events-none" />
          </div>
        </motion.div>
      </div>

      {/* ── Screen Corner Borders ────────────────────────────────────────────── */}
      <div className="absolute top-20 left-0 w-[30vw] h-[20vh] border-t max-w-[400px] border-l border-crusader-gold/20 m-6 pointer-events-none opacity-50" />
      <div className="absolute bottom-12 right-0 w-[30vw] h-[20vh] border-b max-w-[400px] border-r border-crusader-gold/20 m-6 pointer-events-none opacity-50" />

      {/* Corner crosshairs */}
      <div className="absolute top-24 left-6 w-4 h-4 text-crusader-gold/40 z-10 pointer-events-none">
        <div className="absolute w-full h-[1px] bg-current top-1/2 left-0" />
        <div className="absolute h-full w-[1px] bg-current left-1/2 top-0" />
      </div>
      <div className="absolute bottom-16 right-6 w-4 h-4 text-crusader-gold/40 z-10 pointer-events-none">
        <div className="absolute w-full h-[1px] bg-current top-1/2 left-0" />
        <div className="absolute h-full w-[1px] bg-current left-1/2 top-0" />
      </div>

      {/* ── Bottom Status Bar ────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-12 border-t-2 border-crusader-gold/30 bg-black/80 flex items-center justify-between px-10 text-[11px] font-cinzel font-bold tracking-widest uppercase text-crusader-parchment/60 z-20 overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-6">
          <span className="text-crusader-gold shadow-glow-gold">A.D. 1066</span>
          <span className="hidden sm:inline">The Great Campaign</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Realm Status: Peaceful</span>
          <div className="w-2 h-2 rounded-full border border-crusader-gold bg-crusader-gold/50 ml-2" />
        </div>
      </div>
    </div>
  )
}
