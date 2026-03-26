'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Map, Users, Trophy, User, ChevronRight, LogOut } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getSupabaseClient } from '@/lib/supabase'
import { getTierForLevel } from '@/lib/xp'
import FlagAvatar from '@/components/ui/FlagAvatar'

export default function LandingPage() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [latency, setLatency] = useState(24)
  const player = useAppStore((s) => s.player)
  const router = useRouter()
  const tier = player ? getTierForLevel(player.level) : null

  async function handleLogout() {
    await getSupabaseClient().auth.signOut()
    router.refresh()
  }

  const menuItems = [
    { id: 'campaign', label: 'Start / Continue Campaign', icon: Map, href: '/campaign' },
    { id: 'find', label: 'Start or Find a Match', icon: Users, href: '/lobby' },
    { id: 'start', label: 'Maps', icon: Sword, href: '/map-creator' },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy, href: '/leaderboard' },
  ]

  const carouselItems = [
    {
      id: 1,
      title: 'Global Warfare',
      subtitle: 'DOMINATE THE WORLD',
      image: '/showcase/carousel_1.png'
    },
    {
      id: 2,
      title: 'Tactical Combat',
      subtitle: 'FAST PACED STRATEGY',
      image: '/showcase/carousel_2.png'
    },
    {
      id: 3,
      title: 'Command Your Forces',
      subtitle: 'LEAD TO GLORY',
      image: '/showcase/carousel_3.png'
    }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselItems.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [carouselItems.length])

  return (
    <div className="h-screen w-screen bg-crusader-void overflow-hidden text-crusader-parchment font-inter selection:bg-crusader-gold/30 relative">
      {/* ── Background Elements ────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {/* Static Background Image integration - Aligned to show the background logo perfectly */}
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

      {/* ── Top Right Auth Actions ──────────────────────────────────────────── */}
      <div className="absolute top-8 right-10 z-50 flex items-center gap-6">
        <AnimatePresence mode="wait">
          {player ? (
            <motion.div
              key="authed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-5"
            >
              {/* Profile link with avatar */}
              <Link href="/profile" className="flex items-center gap-3 group">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <FlagAvatar
                    flagId={player.avatar_url ?? null}
                    size={36}
                    fallbackLetter={player.username[0]}
                    fallbackColor={player.default_color}
                    className="border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    style={{ borderColor: tier?.color }}
                  />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="font-cinzel text-xs font-bold text-crusader-gold group-hover:glow-gold transition-all leading-none tracking-[0.1em]">
                    {player.username}
                  </p>
                  <p className="text-[10px] leading-none mt-0.5 tracking-widest" style={{ color: tier?.color }}>
                    Lv {player.level} · {tier?.title}
                  </p>
                </div>
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="font-cinzel text-crusader-gold/50 hover:text-crusader-crimson-bright transition-all duration-300 font-bold tracking-[0.2em] text-sm flex items-center gap-2 uppercase"
              >
                <LogOut size={14} /> Logout
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="unauthed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-6"
            >
              <Link
                href="/auth/login"
                className="font-cinzel text-crusader-gold/80 hover:text-crusader-gold hover:glow-gold transition-all duration-300 font-bold tracking-[0.2em] text-sm flex items-center gap-2 uppercase"
              >
                <User size={16} /> Login
              </Link>
              <Link href="/auth/register" className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-crusader-gold/40 to-crusader-crimson/40 rounded blur opacity-25 group-hover:opacity-60 transition duration-500" />
                <div className="relative font-cinzel bg-crusader-dark border-2 border-crusader-gold/60 px-8 py-3 text-crusader-gold tracking-[0.1em] font-bold text-sm flex items-center justify-center group-hover:bg-crusader-gold/10 transition-colors shadow-[0_0_15px_rgba(201,168,76,0.3)] rounded-sm">
                  <span className="uppercase whitespace-nowrap">Join</span>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <div className="relative z-40 h-full w-full max-w-[1920px] mx-auto px-6 md:px-20 pt-6 md:pt-20 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12 lg:gap-0">

        {/* Left Side: Logo and Menu */}
        <div className="flex flex-col gap-4 md:gap-6 w-full lg:w-[45vw] lg:max-w-lg xl:max-w-xl  z-50 items-center lg:items-start text-center lg:text-left">

          {/* Mobile-Only Precise Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex lg:hidden w-full items-center justify-center "
          >
            <img
              src="/CrusadersClub_LOGO.png"
              alt="Crusaders Club"
              className="w-full max-w-[280px] md:max-w-[320px] drop-shadow-[0_0_50px_rgba(139,26,26,0.5)] scale-[1.1]"
            />
          </motion.div>

          {/* Empty Space Placeholder to keep button positioning comfortable on desktop */}
          <div className="hidden lg:block h-28 md:h-44 pointer-events-none" aria-hidden="true" />
          <div className="lg:hidden h-0" aria-hidden="true" /> {/* Minimal padding for mobile logo */}


          {/* Huge Main Menu Buttons */}
          <div className="flex flex-col gap-4 w-full max-w-[450px] lg:max-w-none">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 + (index * 0.1) }}
                  key={item.id}
                  className="w-full"
                >
                  <Link href={item.href} className="group relative block w-full outline-none focus:outline-none focus:ring-0">
                    <div className="relative flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 overflow-hidden transition-all duration-300 bg-gradient-to-r from-crusader-dark/95 to-black/95 border border-crusader-gold/30 group-hover:from-crusader-crimson-bright/80 group-hover:to-crusader-crimson/95 group-hover:border-crusader-gold/80 shadow-[0_4px_20px_rgba(0,0,0,0.8)] rounded-sm">

                      {/* Medieval Texture overlay */}
                      <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />

                      {/* Button Content */}
                      <div className="relative z-20 flex items-center gap-3 md:gap-4 w-full">
                        {/* Icon Box */}
                        <div className="w-10 h-10 md:w-12 md:h-12 flex flex-shrink-0 items-center justify-center bg-black/60 border border-crusader-gold/40 group-hover:border-crusader-gold group-hover:bg-black/80 transition-all duration-300 shadow-inner group-hover:shadow-[0_0_15px_rgba(201,168,76,0.5)] rounded-full">
                          <Icon size={20} className="text-crusader-gold group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                        </div>

                        {/* Label */}
                        <div className="flex flex-col text-left">
                          <span className="font-cinzel text-sm md:text-base lg:text-lg font-black tracking-[0.15em] text-white/90 group-hover:text-white transition-all duration-300 uppercase leading-none drop-shadow-md whitespace-nowrap">
                            {item.label}
                          </span>
                        </div>

                        {/* Right Arrow chevron */}
                        <div className="ml-auto flex-shrink-0 text-crusader-gold/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300 drop-shadow-[0_0_5px_rgba(0,0,0,1)]">
                          <ChevronRight size={24} strokeWidth={2} />
                        </div>
                      </div>

                      {/* Ornate corner accents */}
                      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-crusader-gold/50" />
                      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-crusader-gold/50 group-hover:border-crusader-gold" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Media Carousel Widget */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: 50 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="hidden lg:flex w-[420px] xl:w-[500px] h-[55%] max-h-[500px] relative pointer-events-none items-center justify-center mr-4 xl:mr-10 mb-10"
        >
          {/* Complex Diegetic Frame Structure */}
          <div className="absolute inset-0 border-[3px] border-crusader-wood-dark bg-crusader-void/80 backdrop-blur-md overflow-hidden shadow-[0_15px_60px_rgba(0,0,0,1)] pointer-events-auto rounded-sm group">

            {/* Inner Gold border */}
            <div className="absolute inset-1 border border-crusader-gold/40 z-30 pointer-events-none" />

            {/* Medieval top bar */}
            <div className="absolute top-0 left-0 w-full h-10 bg-gradient-to-b from-crusader-wood-dark to-crusader-void flex items-center justify-center z-30 border-b-2 border-crusader-gold/30">
              <div className="text-xs font-cinzel font-bold tracking-[0.2em] text-crusader-parchment uppercase drop-shadow-md">
                Realm Chronicles
              </div>
            </div>

            {/* Slider */}
            <div className="absolute top-10 bottom-0 left-0 right-0 z-10 p-2">
              <div className="relative w-full h-full overflow-hidden border border-black/50">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    <img
                      src={carouselItems[activeSlide].image}
                      alt={carouselItems[activeSlide].title}
                      className="w-full h-full object-cover"
                    />

                    {/* Gradients to blend text better */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  </motion.div>
                </AnimatePresence>

                {/* Text Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 z-20 flex flex-col items-center text-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSlide}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="border-b border-crusader-gold/50 px-4 py-1 mb-3 inline-block">
                        <p className="text-crusader-gold text-[10px] font-bold tracking-[0.3em] uppercase">{carouselItems[activeSlide].subtitle}</p>
                      </div>
                      <h3 className="font-cinzel text-xl xl:text-3xl font-black text-crusader-parchment uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-tight">
                        {carouselItems[activeSlide].title}
                      </h3>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Slider Dots aligned right */}
            <div className="absolute bottom-6 right-0 left-0 z-30 flex justify-center gap-3">
              {carouselItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`w-2 transition-all duration-500 rounded-full ${activeSlide === i
                    ? 'h-2 bg-crusader-gold shadow-[0_0_10px_rgba(201,168,76,1)]'
                    : 'h-2 bg-white/20 hover:bg-white/60'
                    }`}
                />
              ))}
            </div>

            {/* Diegetic Accents for the frame */}
            <div className="absolute top-12 right-3 w-6 h-6 border-t-2 border-r-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute top-12 left-3 w-6 h-6 border-t-2 border-l-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-crusader-gold/60 pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-crusader-gold/60 pointer-events-none" />
          </div>
        </motion.div>

      </div>

      {/* ── Screen Corners / Borders ────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-[30vw] h-[20vh] border-t max-w-[400px] border-l border-crusader-gold/20 m-6 pointer-events-none opacity-50" />
      <div className="absolute bottom-0 right-0 w-[30vw] h-[20vh] border-b max-w-[400px] border-r border-crusader-gold/20 m-6 pointer-events-none opacity-50" />

      {/* Corner crosshairs */}
      <div className="absolute top-6 left-6 w-4 h-4 text-crusader-gold/40 z-10 pointer-events-none"><div className="absolute w-full h-[1px] bg-current top-1/2 left-0" /><div className="absolute h-full w-[1px] bg-current left-1/2 top-0" /></div>
      <div className="absolute bottom-6 right-6 w-4 h-4 text-crusader-gold/40 z-10 pointer-events-none"><div className="absolute w-full h-[1px] bg-current top-1/2 left-0" /><div className="absolute h-full w-[1px] bg-current left-1/2 top-0" /></div>

      {/* Bottom Data Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 border-t-2 border-crusader-gold/30 bg-black/80 flex items-center justify-between px-10 text-[11px] font-cinzel font-bold tracking-widest uppercase text-crusader-parchment/60 z-20 overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-6">
          <span className="text-crusader-gold shadow-glow-gold">A.D. 1066</span>
          <span className="hidden sm:inline">The Great Campaign</span>
        </div>

        <div className="flex items-center gap-2 relative">
          <span>Realm Status: Peaceful</span>
          <div className="w-2 h-2 rounded-full border border-crusader-gold bg-crusader-gold/50 ml-2" />
        </div>
      </div>
    </div>
  )
}
