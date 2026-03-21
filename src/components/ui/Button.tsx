'use client'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'gold' | 'outline' | 'ghost' | 'danger' | 'ice'
type Size    = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  children:  ReactNode
  loading?:  boolean
  icon?:     ReactNode
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  gold: cn(
    'bg-gradient-to-b from-crusader-gold to-crusader-gold-dim',
    'text-crusader-void font-semibold',
    'border border-crusader-gold',
    'shadow-glow-gold hover:shadow-[0_0_30px_#C9A84C88,0_0_60px_#C9A84C44]',
    'hover:from-crusader-gold-light hover:to-crusader-gold',
  ),
  outline: cn(
    'bg-transparent text-crusader-gold',
    'border border-crusader-gold/40 hover:border-crusader-gold',
    'hover:bg-crusader-gold/10 hover:shadow-glow-gold',
  ),
  ghost: cn(
    'bg-transparent text-crusader-gold-light/70',
    'border border-transparent hover:border-crusader-gold/20',
    'hover:bg-crusader-navy/50 hover:text-crusader-gold',
  ),
  danger: cn(
    'bg-crusader-crimson text-white border border-crusader-crimson/60',
    'hover:bg-crusader-crimson-bright hover:shadow-glow-crimson',
  ),
  ice: cn(
    'bg-transparent text-crusader-glow border border-crusader-glow/40',
    'hover:border-crusader-glow hover:bg-crusader-glow/10 hover:shadow-glow-blue',
  ),
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-8 py-3.5 text-base rounded-xl gap-2.5',
  xl: 'px-10 py-4 text-lg rounded-xl gap-3',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', className, children, loading, icon, fullWidth, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center font-cinzel tracking-widest uppercase',
          'transition-all duration-200 ease-out',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-crusader-gold/50',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </span>
        ) : null}
        <span className={cn('flex items-center gap-inherit', loading && 'invisible')}>
          {icon}
          {children}
        </span>
      </button>
    )
  },
)
Button.displayName = 'Button'

export default Button
