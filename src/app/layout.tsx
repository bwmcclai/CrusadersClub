import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'Crusaders Club — Command the World',
  description: 'The modern AAA strategy battle game. Build maps, forge alliances, conquer the world.',
  keywords:    ['strategy', 'risk', 'board game', 'online', 'multiplayer', 'crusaders'],
  openGraph: {
    title:       'Crusaders Club',
    description: 'Command the World. The modern AAA strategy battle game.',
    type:        'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect"                  href="https://fonts.googleapis.com" />
        <link rel="preconnect"                  href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-crusader-void text-crusader-gold-light antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
