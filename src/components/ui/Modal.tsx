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
          'relative w-full glass rounded-2xl border border-crusader-gold/20',
          'shadow-[0_20px_60px_rgba(0,0,0,0.8)]',
          'animate-slide-up',
          sizeMap[size],
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-crusader-gold/10">
            <h2 className="font-cinzel text-lg font-semibold text-crusader-gold tracking-widest uppercase">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-crusader-gold/40 hover:text-crusader-gold hover:bg-crusader-gold/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
