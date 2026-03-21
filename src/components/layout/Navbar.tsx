'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sword, Map, Users, Trophy, User, Menu, X, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

const navLinks = [
  { href: '/lobby',       label: 'Play',        icon: Sword },
  { href: '/map-creator', label: 'Map Creator',  icon: Map   },
  { href: '/maps',        label: 'Maps',         icon: Map   },
  { href: '/leaderboard', label: 'Leaderboard',  icon: Trophy},
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-40 diegetic-container diegetic-clip"
    >
      {/* Scanner HUD Effect */}
      <div className="scanner-line" />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-crusader-gold/50 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20"> {/* Slightly taller */}
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group relative">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-crusader-gold/20 group-hover:bg-crusader-gold/40 transition-all duration-500 blur-xl scale-125" />
              <img src="/CrusadersClub_LOGO.png" alt="Crusaders Club Logo" className="w-14 h-14 object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.5)] group-hover:scale-110 transition-transform relative z-10" />
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'nav-item-glow flex items-center gap-2 px-3 py-2 text-sm font-cinzel font-semibold tracking-wider transition-all duration-300',
                  pathname === href
                    ? 'active text-crusader-gold'
                    : 'text-crusader-gold-light/40 hover:text-crusader-gold-light',
                )}
              >
                <Icon size={16} className={cn(pathname === href ? 'text-crusader-gold' : 'opacity-50')} />
                {label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/auth/login"
              className="font-cinzel text-sm text-crusader-gold/50 hover:text-crusader-gold transition-all duration-300 font-bold tracking-widest uppercase"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
            >
              <Button variant="gold" size="md" className="px-8 font-cinzel font-bold tracking-widest">
                Join
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-crusader-gold hover:glow-gold transition-all"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="md:hidden border-t border-crusader-gold/20 bg-crusader-void/95 backdrop-blur-xl px-4 py-6 flex flex-col gap-4"
        >
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-4 px-6 py-4 rounded-lg text-lg font-cinzel font-bold tracking-wide transition-all border border-transparent',
                pathname === href
                  ? 'bg-crusader-gold/10 text-crusader-gold border-crusader-gold/20 glow-gold'
                  : 'text-crusader-gold-light/40 hover:bg-crusader-gold/5 hover:text-crusader-gold-light',
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-crusader-gold/30 to-transparent my-2" />
          <Link href="/auth/login"    onClick={() => setMobileOpen(false)} className="px-6 py-2 text-crusader-gold/50 font-cinzel font-bold tracking-widest uppercase">Sign In</Link>
          <div className="px-6">
            <Link href="/auth/register" onClick={() => setMobileOpen(false)}>
              <Button variant="gold" fullWidth className="py-5 font-cinzel font-black tracking-[0.2em]">
                JOIN THE CLUB
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  )
}
