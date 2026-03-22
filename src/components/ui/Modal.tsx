'use client'
import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title?:     string
  children:   ReactNode
  size?:      'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full glass rounded-sm border-[3px] border-crusader-wood-dark',
          'shadow-[0_20px_60px_rgba(0,0,0,0.9)]',
          'animate-slide-up overflow-hidden',
          sizeMap[size],
          className,
        )}
      >
        {/* Inner Gold border and Accents */}
        <div className="absolute inset-1 border border-crusader-gold/40 z-30 pointer-events-none" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-crusader-gold/60 pointer-events-none z-30" />
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-crusader-gold/60 pointer-events-none z-30" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-crusader-gold/60 pointer-events-none z-30" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-crusader-gold/60 pointer-events-none z-30" />

        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-crusader-gold/30 bg-black/40 relative z-20">
            <h2 className="font-cinzel text-xl font-bold text-crusader-parchment tracking-widest uppercase drop-shadow-md">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-sm text-crusader-gold/60 border border-transparent hover:border-crusader-gold/40 hover:text-crusader-gold hover:bg-crusader-gold/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-6 relative z-20">{children}</div>
      </div>
    </div>
  )
}
