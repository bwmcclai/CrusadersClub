'use client'
import { create } from 'zustand'
import type { Player, MapCreatorState, Game } from '@/types'

interface AppState {
  // Auth
  player: Player | null
  setPlayer: (p: Player | null) => void

  // Map Creator
  mapCreator: MapCreatorState
  setMapCreator: (partial: Partial<MapCreatorState>) => void
  resetMapCreator: () => void

  // Active Game
  activeGame: Game | null
  setActiveGame: (g: Game | null) => void
}

const defaultMapCreator: MapCreatorState = {
  step: 'select-region',
  territoryCount: 10,
  mapName: '',
  mapDescription: '',
  territories: [],
  bonusGroups: [],
}

export const useAppStore = create<AppState>((set) => ({
  player: null,
  setPlayer: (player) => set({ player }),

  mapCreator: defaultMapCreator,
  setMapCreator: (partial) =>
    set((s) => ({ mapCreator: { ...s.mapCreator, ...partial } })),
  resetMapCreator: () => set({ mapCreator: defaultMapCreator }),

  activeGame: null,
  setActiveGame: (activeGame) => set({ activeGame }),
}))
