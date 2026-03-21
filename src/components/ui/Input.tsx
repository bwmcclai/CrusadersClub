import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:     string
  error?:     string
  icon?:      ReactNode
  hint?:      string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-cinzel tracking-wide text-crusader-gold/80">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-crusader-gold/40 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl bg-crusader-navy/60 border border-crusader-gold/20',
              'px-4 py-3 text-sm text-crusader-gold-light placeholder:text-crusader-gold/30',
              'focus:outline-none focus:border-crusader-gold/60 focus:ring-1 focus:ring-crusader-gold/30',
              'transition-all duration-200',
              icon && 'pl-10',
              error && 'border-crusader-crimson/60 focus:border-crusader-crimson/80',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-crusader-crimson-bright">{error}</p>}
        {hint && !error && <p className="text-xs text-crusader-gold/40">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export default Input
