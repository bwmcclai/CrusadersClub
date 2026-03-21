'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Map, Users, Trophy, User, ChevronRight } from 'lucide-react'

// Dynamic imports
const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-32 h-32 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
    </div>
  ),
})
const ParticleBackground = dynamic(() => import('@/components/ui/ParticleBackground'), { ssr: false })

export default function LandingPage() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [latency, setLatency] = useState(24)

  const menuItems = [
    { id: 'campaign', label: 'Start / Continue Campaign', icon: Map, href: '/campaign' },
    { id: 'find', label: 'Find a Match', icon: Users, href: '/lobby' },
    { id: 'start', label: 'Start a Match', icon: Sword, href: '/map-creator' },
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
      setLatency(Math.floor(Math.random() * (45 - 20) + 20))
    }, 6000)
    return () => clearInterval(interval)
  }, [carouselItems.length])

  return (
    <div className="h-screen w-screen bg-[#04060D] overflow-hidden text-white font-inter selection:bg-crusader-gold/30 relative">
      {/* ── Background Elements ────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground />

        {/* Globe Background integration */}
        <div className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none transform scale-110 translate-x-[20%] translate-y-[5%]">
          <EarthGlobe autoRotate interactive={false} className="w-full h-full" />
        </div>

        {/* Cinematic Darkness & Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#04060D] via-[#04060D]/90 to-transparent z-10 w-2/3 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060D] via-transparent to-transparent z-10 pointer-events-none" />
      </div>

      {/* ── Top Right Auth Actions ──────────────────────────────────────────── */}
      <div className="absolute top-8 right-10 z-50 flex items-center gap-6">
        <Link
          href="/auth/login"
          className="font-cinzel text-crusader-gold/80 hover:text-crusader-gold hover:glow-gold transition-all duration-300 font-bold tracking-[0.2em] text-sm flex items-center gap-2 uppercase"
        >
          <User size={16} /> Login
        </Link>
        <Link href="/auth/register" className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-crusader-gold to-orange-500 rounded blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
          <div className="relative font-cinzel bg-[#04060D] border border-crusader-gold/50 px-8 py-3 text-crusader-gold tracking-[0.1em] font-bold text-sm flex items-center justify-center transform skew-x-[-15deg] group-hover:bg-crusader-gold/10 transition-colors shadow-[0_0_15px_rgba(201,168,76,0.3)] inset-0">
            <span className="transform skew-x-[15deg] uppercase whitespace-nowrap">Create Account</span>
          </div>
        </Link>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <div className="relative z-40 h-full w-full max-w-[1920px] mx-auto px-10 md:px-20 pt-20 flex items-center justify-between">

        {/* Left Side: Logo and Menu */}
        <div className="flex flex-col gap-10 w-[45vw] lg:w-[40vw] max-w-lg xl:max-w-xl mt-[-5%] ml-8 xl:ml-12 z-50">
          {/* Epic Logo */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="mb-0"
          >
            <img
              src="/CrusadersClub_LOGO.png"
              alt="Crusaders Club"
              className="w-full max-w-[450px] drop-shadow-[0_0_60px_rgba(201,168,76,0.4)] filter brightness-[1.1]"
            />
          </motion.div>

          {/* Huge Main Menu Buttons */}
          <div className="flex flex-col gap-4">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 + (index * 0.1) }}
                  key={item.id}
                >
                  <Link href={item.href} className="group relative block w-full outline-none focus:outline-none focus:ring-0">
                    <div className="relative flex items-center gap-4 px-6 py-4 overflow-hidden transition-all duration-300 transform skew-x-[-12deg] bg-[#070B14]/80 border-y border-white/5 border-l-4 border-l-transparent hover:border-l-crusader-gold group-hover:bg-crusader-gold/5 group-hover:border-y-crusader-gold/40 shadow-lg group-hover:shadow-[0_0_30px_rgba(201,168,76,0.2)] ml-4 backdrop-blur-sm">

                      {/* Animated Scanline Overlay */}
                      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/[0.05] to-transparent transform translate-x-[200%] group-hover:translate-x-[-100%] transition-transform duration-[1.5s] ease-in-out z-10 pointer-events-none" />

                      {/* Button Content - Inverse Skew to keep text perfectly upright */}
                      <div className="relative z-20 flex items-center gap-5 w-full transform skew-x-[12deg]">
                        {/* Icon Box */}
                        <div className="w-12 h-12 flex flex-shrink-0 items-center justify-center bg-black/40 border border-white/10 group-hover:border-crusader-gold/40 group-hover:bg-crusader-gold/20 transition-all duration-300 shadow-inner">
                          <Icon size={24} className="text-white/40 group-hover:text-crusader-gold group-hover:glow-gold transition-colors duration-300" />
                        </div>

                        {/* Label */}
                        <span className="font-cinzel text-lg md:text-xl font-bold tracking-[0.1em] text-white/80 group-hover:text-white group-hover:glow-white transition-all duration-300 uppercase leading-snug">
                          {item.label}
                        </span>

                        {/* Right Arrow chevron */}
                        <div className="ml-auto flex-shrink-0 text-white/0 group-hover:text-crusader-gold group-hover:translate-x-2 transition-all duration-300">
                          <ChevronRight size={24} />
                        </div>
                      </div>

                      {/* Small glowing corner accents block */}
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-crusader-gold/0 group-hover:border-crusader-gold/80 transition-all duration-500 z-10 m-1" />
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
          <div className="absolute inset-0 border border-crusader-gold/20 bg-[#04060D]/60 backdrop-blur-2xl overflow-hidden transform skew-x-[-8deg] shadow-[0_0_60px_rgba(4,6,13,0.9)] pointer-events-auto diegetic-clip group">

            {/* Scifi top bar */}
            <div className="absolute top-0 left-0 w-full h-8 bg-crusader-gold/5 flex items-center px-6 z-30 border-b border-crusader-gold/10">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-crusader-gold/50 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-white/20 rounded-full" />
                <div className="w-2 h-2 bg-white/20 rounded-full" />
              </div>
              <div className="ml-auto text-[9px] font-mono tracking-widest text-crusader-gold/40 uppercase">
                Intel Broadcast // Live
              </div>
            </div>

            {/* Slider */}
            <div className="absolute top-8 bottom-0 left-0 right-0 z-10 p-2">
              <div className="relative w-full h-full overflow-hidden border border-white/5">
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
                      className="w-full h-full object-cover transform skew-x-[8deg] scale-[1.2] ml-[4%]"
                    />

                    {/* Gradients to blend text better */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#04060D] via-[#04060D]/40 to-transparent transform skew-x-[8deg] scale-[1.2] ml-[4%]" />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#04060D]/20 to-[#04060D]/60 transform skew-x-[8deg] scale-[1.2] ml-[4%]" />
                  </motion.div>
                </AnimatePresence>

                {/* Text Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 z-20 flex flex-col items-start gap-1 transform skew-x-[8deg] ml-[2%]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSlide}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="bg-crusader-gold/20 backdrop-blur-sm border-l-2 border-crusader-gold px-2 py-0.5 mb-2 inline-block">
                        <p className="text-crusader-gold text-[9px] font-bold tracking-[0.3em] uppercase">{carouselItems[activeSlide].subtitle}</p>
                      </div>
                      <h3 className="font-cinzel text-xl xl:text-2xl font-black text-white uppercase tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] leading-tight">
                        {carouselItems[activeSlide].title}
                      </h3>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Slider Dots aligned right */}
            <div className="absolute bottom-8 right-6 z-30 flex flex-col gap-2 transform skew-x-[8deg]">
              {carouselItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`w-1.5 transition-all duration-500 rounded-full ${activeSlide === i
                    ? 'h-6 bg-crusader-gold shadow-[0_0_15px_rgba(201,168,76,0.9)]'
                    : 'h-2 bg-white/20 hover:bg-white/60'
                    }`}
                />
              ))}
            </div>

            {/* Diegetic Accents for the frame */}
            <div className="absolute top-10 right-4 w-10 h-10 border-t border-r border-crusader-gold/30 opacity-60 m-2" />
            <div className="absolute bottom-2 left-4 w-10 h-10 border-b border-l border-crusader-gold/30 opacity-60 m-2" />
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
      <div className="absolute bottom-0 left-0 right-0 h-10 border-t border-white/5 bg-[#04060D]/80 flex items-center justify-between px-10 text-[10px] font-mono tracking-widest uppercase text-white/30 z-20 overflow-hidden backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <span className="text-crusader-gold/60">SYS_V // 2.0.4</span>
          <span className="hidden sm:inline">Server: ONLINE [US-EAST]</span>
        </div>

        <div className="flex items-center gap-2 relative">
          <span>{`LATENCY // ${latency}MS`}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-2" />
        </div>
      </div>
    </div>
  )
}
