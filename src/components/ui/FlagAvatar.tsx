'use client'
import { cn } from '@/lib/utils'

interface FlagAvatarProps {
  flagId: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
  fallbackLetter?: string
  fallbackColor?: string
}

export default function FlagAvatar({
  flagId,
  size = 64,
  className,
  fallbackLetter = '?',
  fallbackColor = '#C9A84C',
  style,
}: FlagAvatarProps) {
  // If flagId is something like "flag:2,1", we parse it into x=2, y=1 (cols=6, rows=4)
  const isFlag = flagId?.startsWith('flag:')
  
  if (isFlag && flagId) {
    const coords = flagId.split(':')[1].split(',')
    const col = parseInt(coords[0], 10)
    const row = parseInt(coords[1], 10)
    
    // We assume a 6x4 grid on the Flags.png image.
    // Width: 1920 / 6 = 320. Height: 1046 / 4 = 261.5
    // But CSS background-position uses percentages ideally:
    // x% = (col / (cols - 1)) * 100
    // y% = (row / (rows - 1)) * 100
    const cols = 6
    const rows = 4
    
    const xPos = cols > 1 ? (col / (cols - 1)) * 100 : 0
    const yPos = rows > 1 ? (row / (rows - 1)) * 100 : 0
    
    return (
      <div
        className={cn('relative overflow-hidden rounded-full border-2 border-crusader-gold/50 shadow-inner', className)}
        style={{
          width: size,
          height: size,
          backgroundImage: 'url(/Flags.png)',
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: `${xPos}% ${yPos}%`,
          backgroundColor: '#1a1a1a', // Fallback
          ...style,
        }}
      />
    )
  }

  // Fallback to URL or Letter
  if (flagId && flagId.startsWith('http')) {
    return (
      <div
        className={cn('relative overflow-hidden rounded-full border-2 border-crusader-gold/50', className)}
        style={{ width: size, height: size, ...style }}
      >
        <img src={flagId} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center rounded-full font-cinzel font-bold border-2 border-crusader-gold/50', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: fallbackColor + '22',
        color: fallbackColor,
        fontSize: size * 0.4,
        ...style,
      }}
    >
      {fallbackLetter.toUpperCase()}
    </div>
  )
}
