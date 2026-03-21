'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sword, Map, Users, Trophy, User, Menu, X, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

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
      className="fixed top-0 left-0 right-0 z-40 glass-deep border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-crusader-gold/10 group-hover:bg-crusader-gold/20 transition-colors blur-md" />
              <img src="/CrusadersClub_LOGO.png" alt="Crusaders Club Logo" className="w-10 h-10 object-contain drop-shadow-lg group-hover:scale-110 transition-transform relative z-10" />
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'hover:bg-crusader-gold/10 hover:text-crusader-gold',
                  pathname === href
                    ? 'text-crusader-gold bg-crusader-gold/10'
                    : 'text-crusader-gold-light/60',
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-crusader-gold/70 hover:text-crusader-gold transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-cinzel font-semibold tracking-wide uppercase',
                'bg-crusader-gold text-crusader-void',
                'hover:bg-crusader-gold-light transition-all duration-200',
                'shadow-glow-gold',
              )}
            >
              Join
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-crusader-gold"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-crusader-gold/10 px-4 py-4 flex flex-col gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium',
                pathname === href
                  ? 'bg-crusader-gold/15 text-crusader-gold'
                  : 'text-crusader-gold-light/60 hover:bg-crusader-navy/50',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <div className="divider-gold my-2" />
          <Link href="/auth/login"    onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm text-crusader-gold/70">Sign In</Link>
          <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-cinzel text-crusader-gold font-bold tracking-wide uppercase">Join the Club</Link>
        </div>
      )}
    </motion.nav>
  )
}
