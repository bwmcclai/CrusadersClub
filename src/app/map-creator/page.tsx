'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import TerritoryMap from '@/components/three/TerritoryMap'
import { generateTerritories, mercatorProject } from '@/lib/utils'
import type { Territory, BonusGroup } from '@/types'
import {
  Globe, Map, ChevronRight, Shuffle, Save, ArrowLeft,
  Info, Layers, Edit3, CheckCircle, Plus, Sword,
} from 'lucide-react'

const EarthGlobe = dynamic(() => import('@/components/three/EarthGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-crusader-void">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-crusader-gold/30 border-t-crusader-gold animate-spin" />
        <p className="text-crusader-gold/60 font-cinzel text-sm tracking-widest">Loading Globe...</p>
      </div>
    </div>
  ),
})

type Step = 'select' | 'configure' | 'preview' | 'save'

const STEPS: { id: Step; label: string; icon: typeof Globe }[] = [
  { id: 'select',    label: 'Select Region', icon: Globe    },
  { id: 'configure', label: 'Configure',     icon: Layers   },
  { id: 'preview',   label: 'Preview Map',   icon: Map      },
  { id: 'save',      label: 'Save & Share',  icon: Save     },
]

export default function MapCreatorPage() {
  const [step, setStep]           = useState<Step>('select')
  const [selected, setSelected]   = useState<{ id: number; name: string; feature: GeoJSON.Feature } | null>(null)
  const [mapName, setMapName]     = useState('')
  const [mapDesc, setMapDesc]     = useState('')
  const [tCount, setTCount]       = useState(12)
  const [territories, setTerritories] = useState<Territory[]>([])
  const [bonusGroups, setBonusGroups] = useState<BonusGroup[]>([])
  const [generating, setGenerating]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [savedId, setSavedId]     = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameInput, setNameInput]     = useState('')

  const handleCountrySelect = useCallback(
    (id: number, name: string, feature: GeoJSON.Feature) => {
      setSelected({ id, name, feature })
      setMapName(`${name} — ${new Date().getFullYear()}`)
      setStep('configure')
    },
    [],
  )

  async function handleGenerate() {
    if (!selected?.feature) return
    setGenerating(true)

    await new Promise((r) => setTimeout(r, 300)) // allow UI update

    try {
      const geo = selected.feature.geometry
      let rings: [number, number][][] = []
      if (geo.type === 'Polygon') {
        rings = geo.coordinates as [number, number][][]
      } else if (geo.type === 'MultiPolygon') {
        // Use the largest polygon
        const sorted = [...geo.coordinates].sort((a, b) => b[0].length - a[0].length)
        rings = sorted[0] as [number, number][][]
      }

      if (!rings.length) {
        setGenerating(false)
        return
      }

      const result = generateTerritories(rings, tCount)
      setTerritories(result.territories)
      setBonusGroups(result.bonusGroups)
      setStep('preview')
    } finally {
      setGenerating(false)
    }
  }

  function handleRegenerate() {
    handleGenerate()
  }

  function startRenameTerritory(t: Territory) {
    setEditingName(t.id)
    setNameInput(t.name)
  }

  function commitRename() {
    if (!editingName) return
    setTerritories((ts) =>
      ts.map((t) => (t.id === editingName ? { ...t, name: nameInput } : t)),
    )
    setEditingName(null)
  }

  async function handleSave() {
    setSaving(true)
    // TODO: Supabase insert battlemap
    await new Promise((r) => setTimeout(r, 1200))
    setSavedId('map-' + Date.now())
    setSaving(false)
    setStep('save')
  }

  const currentStepIdx = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="min-h-screen bg-crusader-void flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16 flex flex-col">
        {/* ── Progress bar ────────────────────────────────────────────────── */}
        <div className="border-b border-crusader-gold/10 bg-crusader-dark/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              {STEPS.map((s, i) => {
                const Icon      = s.icon
                const isActive  = s.id === step
                const isPast    = i < currentStepIdx
                return (
                  <div key={s.id} className="flex items-center gap-2 sm:gap-4">
                    <button
                      disabled={!isPast && !isActive}
                      onClick={() => isPast && setStep(s.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-cinzel tracking-wide transition-all
                        ${isActive  ? 'bg-crusader-gold/20 text-crusader-gold border border-crusader-gold/40' :
                          isPast    ? 'text-crusader-gold/50 cursor-pointer hover:text-crusader-gold' :
                                      'text-crusader-gold/20 cursor-not-allowed'}`}
                    >
                      {isPast ? <CheckCircle size={14} /> : <Icon size={14} />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <ChevronRight size={14} className="text-crusader-gold/20 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Step: Select Region ─────────────────────────────────────────── */}
        {step === 'select' && (
          <div className="flex-1 relative">
            <EarthGlobe
              interactive
              autoRotate={!selected}
              onCountrySelect={handleCountrySelect}
              className="absolute inset-0 w-full h-full"
            />

            {/* Instructions overlay */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="glass px-6 py-3 rounded-full border border-crusader-gold/20">
                <p className="text-sm font-cinzel text-crusader-gold/80 tracking-widest text-center">
                  Click a country on the globe to start your map
                </p>
              </div>
            </div>

            {/* Selected country tooltip */}
            {selected && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-slide-up">
                <Card className="px-6 py-4 flex items-center gap-4">
                  <Globe size={20} className="text-crusader-gold flex-shrink-0" />
                  <div>
                    <p className="font-cinzel text-crusader-gold font-semibold">{selected.name}</p>
                    <p className="text-xs text-crusader-gold/50 mt-0.5">Region selected</p>
                  </div>
                  <Button size="sm" onClick={() => setStep('configure')}>
                    Continue <ChevronRight size={14} />
                  </Button>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Configure ─────────────────────────────────────────────── */}
        {step === 'configure' && selected && (
          <div className="flex-1 flex flex-col lg:flex-row">
            {/* Globe preview (50%) */}
            <div className="lg:flex-1 h-80 lg:h-auto relative">
              <EarthGlobe
                interactive={false}
                autoRotate={false}
                className="absolute inset-0 w-full h-full"
              />
              {/* Region label */}
              <div className="absolute bottom-6 left-6">
                <div className="glass px-4 py-2 rounded-xl">
                  <p className="text-xs text-crusader-gold/60 font-cinzel tracking-wide">Selected Region</p>
                  <p className="font-cinzel text-lg font-bold text-crusader-gold">{selected.name}</p>
                </div>
              </div>
            </div>

            {/* Config panel */}
            <div className="lg:w-96 p-6 flex flex-col gap-6 border-l border-crusader-gold/10 overflow-y-auto">
              <div>
                <button
                  onClick={() => setStep('select')}
                  className="flex items-center gap-2 text-xs text-crusader-gold/50 hover:text-crusader-gold transition-colors mb-4"
                >
                  <ArrowLeft size={12} /> Back to Globe
                </button>
                <h2 className="font-cinzel text-xl font-bold text-crusader-gold">Configure Map</h2>
                <p className="text-sm text-crusader-gold/50 mt-1">Set up your battle map details</p>
              </div>

              <Input
                label="Map Name"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="Enter a name..."
              />

              <Input
                label="Description (optional)"
                value={mapDesc}
                onChange={(e) => setMapDesc(e.target.value)}
                placeholder="A brief description..."
              />

              {/* Territory count */}
              <div>
                <label className="text-sm font-cinzel tracking-wide text-crusader-gold/80 block mb-2">
                  Territories: <span className="text-crusader-gold font-bold">{tCount}</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={tCount}
                  onChange={(e) => setTCount(Number(e.target.value))}
                  className="w-full accent-crusader-gold cursor-pointer"
                />
                <div className="flex justify-between text-xs text-crusader-gold/30 mt-1">
                  <span>5 (Small)</span>
                  <span>30 (Epic)</span>
                </div>
                <p className="text-xs text-crusader-gold/40 mt-2 flex items-start gap-1.5">
                  <Info size={12} className="flex-shrink-0 mt-0.5" />
                  More territories = longer, deeper games. 10–15 is ideal for beginners.
                </p>
              </div>

              <div className="divider-gold" />

              <div className="flex flex-col gap-3">
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!mapName.trim()}
                >
                  Generate Territories
                </Button>
                <p className="text-xs text-crusader-gold/30 text-center">
                  Territories are auto-generated using Voronoi tessellation
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Preview ────────────────────────────────────────────────── */}
        {step === 'preview' && territories.length > 0 && (
          <div className="flex-1 flex flex-col lg:flex-row">
            {/* Map canvas */}
            <div className="lg:flex-1 relative bg-crusader-dark/40" style={{ minHeight: '60vh' }}>
              <div className="absolute inset-0 p-4">
                <TerritoryMap
                  territories={territories}
                  editorMode
                  className="w-full h-full"
                />
              </div>

              {/* Floating controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <Button size="sm" variant="outline" icon={<Shuffle size={14} />} onClick={handleRegenerate} loading={generating}>
                  Regenerate
                </Button>
              </div>

              {/* Background grid */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
            </div>

            {/* Side panel */}
            <div className="lg:w-80 border-l border-crusader-gold/10 flex flex-col">
              {/* Territory list */}
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="font-cinzel text-sm font-semibold text-crusader-gold/70 tracking-widest uppercase mb-3">
                  Territories ({territories.length})
                </h3>
                <div className="space-y-1.5">
                  {territories.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-crusader-gold/5 group border border-transparent hover:border-crusader-gold/10 transition-all"
                    >
                      {editingName === t.id ? (
                        <input
                          className="flex-1 bg-transparent border-b border-crusader-gold/40 text-sm text-crusader-gold focus:outline-none"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="text-sm text-crusader-gold-light/70">{t.name}</span>
                          <button
                            onClick={() => startRenameTerritory(t)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-crusader-gold/40 hover:text-crusader-gold transition-all"
                          >
                            <Edit3 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <div className="p-4 border-t border-crusader-gold/10">
                <Button fullWidth size="lg" icon={<Save size={16} />} onClick={handleSave} loading={saving}>
                  Save Map
                </Button>
                <p className="text-xs text-crusader-gold/30 text-center mt-2">{mapName}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Saved ──────────────────────────────────────────────────── */}
        {step === 'save' && savedId && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-crusader-gold/20 border border-crusader-gold/40 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={36} className="text-crusader-gold" />
              </div>
              <h2 className="font-cinzel text-3xl font-bold text-crusader-gold glow-gold mb-3">Map Saved!</h2>
              <p className="text-crusader-gold-light/60 mb-2">
                <span className="text-crusader-gold font-semibold">{mapName}</span> has been published to the community.
              </p>
              <p className="text-sm text-crusader-gold/40 mb-8">{territories.length} territories · {selected?.name}</p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/lobby">
                  <Button size="lg" icon={<Sword size={18} />}>Play This Map</Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  icon={<Plus size={18} />}
                  onClick={() => {
                    setStep('select')
                    setSelected(null)
                    setTerritories([])
                    setSavedId(null)
                    setMapName('')
                  }}
                >
                  Create Another
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

