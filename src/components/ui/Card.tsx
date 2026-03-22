'use client'
import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children:   ReactNode
  className?: string
  glow?:      'gold' | 'blue' | 'crimson' | 'none'
  hover?:     boolean
  onClick?:   () => void
}

const glowMap = {
  gold:    'hover:border-crusader-gold/60 hover:shadow-glow-gold',
  blue:    'hover:border-crusader-glow/60 hover:shadow-glow-blue',
  crimson: 'hover:border-crusader-crimson/60 hover:shadow-glow-crimson',
  none:    '',
}

export default function Card({ children, className, glow = 'gold', hover = false, onClick }: CardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -5, scale: 1.02 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={cn(
        'glass rounded-sm relative overflow-hidden transition-shadow duration-300',
        glowMap[glow],
        hover && 'cursor-pointer',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-crusader-gold/50 pointer-events-none" />
      <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-crusader-gold/50 pointer-events-none" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-crusader-gold/50 pointer-events-none" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-crusader-gold/50 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 pt-6 pb-4', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 pb-6', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-t border-crusader-gold/10', className)}>
      {children}
    </div>
  )
}
