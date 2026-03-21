'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  // Auto-play the video when the component mounts, but browsers often require interaction.
  // We'll try to auto-play, if it fails, we show a play button overlay.
  useEffect(() => {
    const video = document.getElementById('intro-video') as HTMLVideoElement
    if (video) {
      video.play().then(() => {
        setIsPlaying(true)
      }).catch((e) => {
        console.warn("Autoplay blocked, user interaction required:", e)
      })
    }
  }, [])

  const handleComplete = () => {
    setIsFinished(true)
    setTimeout(() => {
      onComplete()
    }, 1000) // allow fade out animation to finish
  }

  const handlePlayClick = () => {
    const video = document.getElementById('intro-video') as HTMLVideoElement
    if (video) {
      video.play()
      setIsPlaying(true)
    }
  }

  return (
    <AnimatePresence>
      {!isFinished && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
        >
          <video
            id="intro-video"
            src="/Intro.mp4"
            className="w-full h-full object-cover"
            playsInline
            onEnded={handleComplete}
          />
          
          {/* Overlay to catch clicks if autoplay fails */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-6 z-10 backdrop-blur-sm">
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(201, 168, 76, 0.5)' }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlayClick}
                className="w-20 h-20 rounded-full bg-crusader-gold/20 border border-crusader-gold text-crusader-gold flex items-center justify-center shadow-glow-gold hover:bg-crusader-gold/30 transition-colors"
              >
                <Play size={32} className="ml-2" />
              </motion.button>
              <h2 className="font-cinzel text-crusader-gold tracking-[0.2em] text-sm uppercase">Click to Enter</h2>
            </div>
          )}

          {/* Skip Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isPlaying ? 0.5 : 0 }}
            whileHover={{ opacity: 1 }}
            onClick={handleComplete}
            className="absolute bottom-8 right-8 text-white/50 hover:text-white font-inter text-sm tracking-widest uppercase transition-colors z-20"
          >
            Skip Intro
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
