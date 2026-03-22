'use client'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

type Variant = 'gold' | 'outline' | 'ghost' | 'danger' | 'ice'
type Size    = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?:  Variant
  size?:     Size
  children:  ReactNode
  loading?:  boolean
  icon?:     ReactNode
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  gold: cn(
    'bg-gradient-to-b from-crusader-wood to-crusader-wood-dark',
    'text-crusader-parchment font-bold',
    'border border-crusader-gold/60',
    'shadow-[0_4px_10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(201,168,76,0.3)] hover:shadow-[0_6px_15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(201,168,76,0.5)]',
    'hover:from-[#3c281e] hover:to-[#281c14] hover:text-white',
  ),
  outline: cn(
    'bg-crusader-void/80 text-crusader-gold',
    'border border-crusader-gold/40 hover:border-crusader-gold',
    'hover:bg-crusader-gold/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]',
  ),
  ghost: cn(
    'bg-transparent text-crusader-parchment/70',
    'border border-transparent hover:border-crusader-gold/20',
    'hover:bg-crusader-wood/50 hover:text-crusader-gold',
  ),
  danger: cn(
    'bg-gradient-to-b from-crusader-crimson-bright to-crusader-crimson text-white border border-crusader-gold/40',
    'hover:brightness-110 shadow-[0_4px_10px_rgba(0,0,0,0.6)]',
  ),
  ice: cn(
    'bg-transparent text-crusader-parchment border border-crusader-parchment/40',
    'hover:border-crusader-parchment hover:bg-crusader-parchment/10',
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
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
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
      </motion.button>
    )
  },
)
Button.displayName = 'Button'

export default Button
