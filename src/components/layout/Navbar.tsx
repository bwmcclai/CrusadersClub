'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sword, Map, Trophy, User, Menu, X, LogOut, ChevronDown, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { useAppStore } from '@/lib/store'
import { getSupabaseClient } from '@/lib/supabase'
import { getTierForLevel } from '@/lib/xp'
import FlagAvatar from '@/components/ui/FlagAvatar'

const navLinks = [
  { href: '/lobby',       label: 'Play',        icon: Sword  },
  { href: '/maps',        label: 'Maps',         icon: Map    },
  { href: '/players',     label: 'Players',      icon: Users  },
  { href: '/leaderboard', label: 'Leaderboard',  icon: Trophy },
]

/** Compact avatar circle — shows image or colored initial */
function NavAvatar({ size = 36 }: { size?: number }) {
  const player = useAppStore((s) => s.player)
  if (!player) return null

  const tier = getTierForLevel(player.level)

  return (
    <FlagAvatar 
      flagId={player.avatar_url ?? null} 
      size={size} 
      fallbackLetter={player.username[0]} 
      fallbackColor={player.default_color} 
      style={{ borderColor: tier.color }}
    />
  )
}

export default function Navbar() {
  const pathname    = usePathname()
  const router      = useRouter()
  const player      = useAppStore((s) => s.player)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [profileOpen, setProfileOpen]   = useState(false)

  const tier = player ? getTierForLevel(player.level) : null

  async function handleLogout() {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    setMobileOpen(false)
    setProfileOpen(false)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 diegetic-container"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crusader-gold/80 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-crusader-gold/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group relative">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-crusader-gold/20 group-hover:bg-crusader-gold/40 transition-all duration-500 blur-xl scale-125" />
              <img src="/CrusadersClub_LOGO.png" alt="Crusaders Club Logo" className="w-14 h-14 object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.5)] group-hover:scale-110 transition-transform relative z-10" />
            </div>
          </Link>

          {/* Desktop nav links */}
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

          {/* Desktop auth section */}
          <div className="hidden md:flex items-center gap-4">
            <AnimatePresence mode="wait">
              {player ? (
                <motion.div
                  key="logged-in"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4"
                >
                  {/* Profile dropdown trigger */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="flex items-center gap-2.5 group focus:outline-none"
                    >
                      <NavAvatar />
                      <div className="text-left">
                        <p className="font-cinzel text-xs font-bold text-crusader-gold leading-none">
                          {player.username}
                        </p>
                        <p className="text-[10px] leading-none mt-0.5" style={{ color: tier?.color }}>
                          Lv {player.level} · {tier?.title}
                        </p>
                      </div>
                      <ChevronDown
                        size={14}
                        className={cn(
                          'text-crusader-gold/50 transition-transform duration-200',
                          profileOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-48 glass rounded-xl border border-crusader-gold/20 overflow-hidden shadow-glow-gold"
                        >
                          <Link
                            href="/profile"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-cinzel text-crusader-gold-light/70 hover:text-crusader-gold hover:bg-crusader-gold/10 transition-colors"
                          >
                            <User size={14} />
                            Profile
                          </Link>
                          <Link
                            href="/dashboard"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-cinzel text-crusader-gold-light/70 hover:text-crusader-gold hover:bg-crusader-gold/10 transition-colors"
                          >
                            <Sword size={14} />
                            Dashboard
                          </Link>
                          <div className="h-[1px] bg-crusader-gold/10 mx-3" />
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-cinzel text-crusader-crimson-bright/70 hover:text-crusader-crimson-bright hover:bg-crusader-crimson/10 transition-colors"
                          >
                            <LogOut size={14} />
                            Logout
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="logged-out"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-6"
                >
                  <Link
                    href="/auth/login"
                    className="font-cinzel text-sm text-crusader-gold/50 hover:text-crusader-gold transition-all duration-300 font-bold tracking-widest uppercase"
                  >
                    Sign In
                  </Link>
                  <Link href="/auth/register">
                    <Button variant="gold" size="md" className="px-8 font-cinzel font-bold tracking-widest">
                      Join
                    </Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile toggle */}
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
          {/* Mobile player info */}
          {player && (
            <div className="flex items-center gap-3 px-6 pb-2">
              <NavAvatar size={44} />
              <div>
                <p className="font-cinzel font-bold text-crusader-gold">{player.username}</p>
                <p className="text-xs" style={{ color: tier?.color }}>
                  Lv {player.level} · {tier?.title}
                </p>
              </div>
            </div>
          )}

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

          {player ? (
            <>
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-4 px-6 py-4 rounded-lg text-lg font-cinzel font-bold tracking-wide text-crusader-gold-light/40 hover:bg-crusader-gold/5 hover:text-crusader-gold-light transition-all border border-transparent"
              >
                <User size={20} />
                Profile
              </Link>
              <div className="px-6">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-cinzel font-bold tracking-widest text-sm text-crusader-crimson-bright border border-crusader-crimson/30 hover:bg-crusader-crimson/10 transition-all"
                >
                  <LogOut size={16} />
                  LOGOUT
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="px-6 py-2 text-crusader-gold/50 font-cinzel font-bold tracking-widest uppercase">
                Sign In
              </Link>
              <div className="px-6">
                <Link href="/auth/register" onClick={() => setMobileOpen(false)}>
                  <Button variant="gold" fullWidth className="py-5 font-cinzel font-black tracking-[0.2em]">
                    JOIN THE CLUB
                  </Button>
                </Link>
              </div>
            </>
          )}
        </motion.div>
      )}
    </nav>
  )
}
