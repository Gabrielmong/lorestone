import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Button, Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SettingsIcon from '@mui/icons-material/Settings'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CasinoIcon from '@mui/icons-material/Casino'
import { useDiceStore, type RollResult, type DiceSet } from '../store/dice'
import DiceSetManager from './DiceSetManager'

const DIE_TYPES = [
  { sides: 20, label: 'd20' },
  { sides: 12, label: 'd12' },
  { sides: 10, label: 'd10' },
  { sides: 8,  label: 'd8'  },
  { sides: 6,  label: 'd6'  },
  { sides: 4,  label: 'd4'  },
  { sides: 100, label: 'd%' },
]

function DieFaceIcon({ sides, size = 48 }: { sides: number; size?: number }) {
  const s = size
  const fill = '#c8a44a'

  if (sides === 20) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={fill}>
      <path d="M217.5 56.4L77.9 140.2l61.4 44.7L217.5 56.4zM64 169.6V320.3l59.2-107.6L64 169.6zM104.8 388L240 469.1V398.8L104.8 388zM272 469.1L407.2 388 272 398.8v70.3zM448 320.3V169.6l-59.2 43L448 320.3zM434.1 140.2L294.5 56.4l78.2 128.4 61.4-44.7zM243.7 3.4c7.6-4.6 17.1-4.6 24.7 0l200 120c7.2 4.3 11.7 12.1 11.7 20.6V368c0 8.4-4.4 16.2-11.7 20.6l-200 120c-7.6 4.6-17.1 4.6-24.7 0l-200-120C36.4 384.2 32 376.4 32 368V144c0-8.4 4.4-16.2 11.7-20.6l200-120zM225.3 365.5L145 239.4 81.9 354l143.3 11.5zM338.9 224H173.1L256 354.2 338.9 224zM256 54.8L172.5 192H339.5L256 54.8zm30.7 310.7L430.1 354 367 239.4 286.7 365.5z" />
    </svg>
  )
  if (sides === 12) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={fill}>
      <path d="M200.3 32c-2.8 0-5.6 .7-8 2.1L128.7 70.9 256 111.2 383.3 70.9 319.7 34.1c-2.4-1.4-5.2-2.1-8-2.1L200.3 32zM92 92.8c-.8 .9-1.6 1.9-2.2 2.9L34.2 192.2c.6 .5 1.2 1 1.7 1.6l95.8 106.4L240 246.1V139.7L92 92.8zM32 237.3l0 74.4c0 2.8 .7 5.6 2.1 8l55.7 96.5c1.4 2.4 3.4 4.5 5.9 5.9l62.7 36.2-44.5-130L32 237.3zM199.7 480c.2 0 .4 0 .6 0H311.7c.7 0 1.4 0 2.1-.1l50.6-151.8L256 273.9 147.7 328.1l52 151.9zM355 457.5l61.2-35.4c2.4-1.4 4.5-3.4 5.9-5.9l55.7-96.5c1.4-2.4 2.1-5.2 2.1-8V237.3l-81.9 90.9L355 457.5zM477.8 192.2L422.1 95.7c-.6-1.1-1.3-2-2.2-2.9L272 139.7V246.1l108.3 54.1 95.8-106.4c.5-.6 1.1-1.1 1.7-1.6zM176.3 6.4c7.3-4.2 15.6-6.4 24-6.4H311.7c8.4 0 16.7 2.2 24 6.4l96.5 55.7c7.3 4.2 13.4 10.3 17.6 17.6l55.7 96.5c4.2 7.3 6.4 15.6 6.4 24V311.7c0 8.4-2.2 16.7-6.4 24l-55.7 96.5c-4.2 7.3-10.3 13.4-17.6 17.6l-96.5 55.7c-7.3 4.2-15.6 6.4-24 6.4H200.3c-8.4 0-16.7-2.2-24-6.4L79.7 449.8c-7.3-4.2-13.4-10.3-17.6-17.6L6.4 335.7c-4.2-7.3-6.4-15.6-6.4-24V200.3c0-8.4 2.2-16.7 6.4-24L62.2 79.7c4.2-7.3 10.3-13.4 17.6-17.6L176.3 6.4z" />
    </svg>
  )
  if (sides === 100) return (
    <svg width={s} height={s} viewBox="0 0 45 33" fill={fill}>
      <path fillRule="evenodd" clipRule="evenodd" d="M17.1406 0.554688C16.8281 0.179688 16.3906 -0.0078125 16.0156 -0.0078125C15.5781 -0.0078125 15.1406 0.179688 14.8906 0.554688L0.390625 17.0547C0.078125 17.3047 -0.046875 17.7422 0.015625 18.1172C0.015625 18.4922 0.203125 18.8672 0.515625 19.1797L15.0156 31.6797C15.5781 32.1172 16.3906 32.1172 16.9531 31.6797L31.4531 19.1797C31.7656 18.8672 31.9531 18.5547 31.9531 18.1172C32.0156 17.7422 31.8906 17.3047 31.6406 17.0547L17.1406 0.554688ZM3.45312 16.5547L13.3281 5.30469L9.26562 15.1797L3.45312 16.5547ZM15.0156 28.9922L3.01562 18.6797L9.76562 17.1172L15.0156 20.5547V28.9922ZM28.9531 18.6797L17.0156 28.9922V20.5547L22.2031 17.1172L28.9531 18.6797ZM18.6406 5.30469L28.5156 16.5547L22.7031 15.1797L18.6406 5.30469ZM20.7656 15.6172L16.0156 18.8047L11.2031 15.6172L16.0156 4.11719L20.7656 15.6172Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M35.1712 17.125L33.9668 17.9231C33.9651 17.2348 33.7494 16.506 33.2934 15.9205L33.7337 15.625L28.9837 4.125L27.0316 8.78987L25.5563 7.1111L26.2962 5.3125L25.1366 6.63355L23.8301 5.1468L27.8587 0.5625C28.1087 0.1875 28.5462 0 28.9837 0C29.3587 0 29.7962 0.1875 30.1087 0.5625L44.6087 17.0625C44.8587 17.3125 44.9837 17.75 44.9212 18.125C44.9212 18.5625 44.7337 18.875 44.4212 19.1875L29.9212 31.6875C29.3587 32.125 28.5462 32.125 27.9837 31.6875L23.9991 28.2525L25.5541 26.912L27.9837 29V24.8175L29.9837 23.0933V29L41.9212 18.6875L35.1712 17.125ZM41.4837 16.5625L31.6087 5.3125L35.6712 15.1875L41.4837 16.5625Z" />
    </svg>
  )
  if (sides === 10) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={fill}>
      <path d="M213.8 84.1L55.6 264.1l92.7-21.8L213.8 84.1zM48.6 298.6L240 463.6V328.6l-83.1-55.4L48.6 298.6zM272 463.6l191.4-165L355.1 273.2 272 328.6V463.6zM456.4 264.1L298.2 84.1l65.4 158.2 92.7 21.8zM256 0c6.9 0 13.5 3 18 8.2l232 264c4.2 4.8 6.4 11.1 5.9 17.5s-3.4 12.3-8.3 16.5l-232 200c-9 7.8-22.3 7.8-31.3 0l-232-200C3.5 302 .5 296 .1 289.7S1.7 277 6 272.2L238 8.2C242.5 3 249.1 0 256 0zm0 300.8L332.2 250 256 65.8 179.8 250 256 300.8z" />
    </svg>
  )
  if (sides === 8) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={fill}>
      <path d="M240 51.3L44.3 247.1l195.7 81V51.3zM72.8 293.5L240 460.7v-98L72.8 293.5zM272 460.7L439.2 293.5 272 362.7v98zM467.8 247.1L272 51.3V328.1l195.8-81zM239 7c9.4-9.4 24.6-9.4 33.9 0L505 239c9.4 9.4 9.4 24.6 0 33.9L273 505c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L239 7z" />
    </svg>
  )
  if (sides === 6) return (
    <svg width={s} height={s} viewBox="0 0 448 512" fill={fill}>
      <path d="M220.1 35.6L47.9 136.2l176 101.2L400 133l-172-97.5 11.6-20.4L228.1 35.5c-2.5-1.4-5.5-1.4-8 .1zM32 164V366.6c0 2.9 1.6 5.6 4.1 7L208 469.9V265.3L32 164zM240 469.9l171.9-96.3c2.5-1.4 4.1-4.1 4.1-7V160.8L240 265.1V469.9zM203.9 7.9c12.3-7.2 27.5-7.3 39.9-.3L427.7 112c12.5 7.1 20.3 20.4 20.3 34.8V366.6c0 14.5-7.8 27.8-20.5 34.9l-184 103c-12.1 6.8-26.9 6.8-39.1 0l-184-103C7.8 394.4 0 381.1 0 366.6V150.1c0-14.2 7.5-27.4 19.8-34.5L203.9 7.9z" />
    </svg>
  )
  // d4
  return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={fill}>
      <path d="M240.1 56.5L35.4 310.6 240.1 465.9V56.5zm32 409.2L476.6 310.6 272.1 56.7V465.8zM256 0c7.3 0 14.1 3.3 18.7 8.9l232 288c4.1 5.1 5.9 11.5 5.1 18s-4.1 12.3-9.3 16.2l-232 176c-8.6 6.5-20.4 6.5-29 0l-232-176c-5.2-3.9-8.5-9.8-9.3-16.2s1.1-12.9 5.1-18l232-288C241.9 3.3 248.7 0 256 0z" />
    </svg>
  )
}

function buildNotation(counts: Record<number, number>) {
  return DIE_TYPES.filter((d) => counts[d.sides] > 0)
    .map((d) => `${counts[d.sides]}d${d.sides}`)
    .join('+')
}


/** Convert our DiceSet model to the config object DiceBox expects */
function diceBoxConfig(set: DiceSet) {
  const cfg: Record<string, unknown> = {
    assetPath: '/',
    theme_surface: set.surface,
    sounds: true,
    shadows: true,
    light_intensity: 1,
    gravity_multiplier: 600,
    baseScale: 100,
    strength: 2,
  }

  if (set.colorset) {
    // Named built-in colorset (Classic preset)
    cfg.theme_colorset = set.colorset
    cfg.theme_material = set.material
    cfg.theme_texture = set.texture || ''
  } else {
    // Custom colorset — matches the demo API exactly
    cfg.theme_customColorset = {
      background: set.customBg,
      foreground: set.customFg,
      texture: set.texture || 'none',
      material: set.material,
    }
  }

  return cfg
}

export default function DiceRoller({ localOnly = false }: { localOnly?: boolean }) {
  const {
    isOpen, close,
    activeDiceSetId, getActiveSet, getAllSets, setActiveDiceSet,
    addRollResult, rollHistory, clearHistory,
    pendingRoll, clearPendingRoll,
    onRollCompleteCallback, setOnRollCompleteCallback,
  } = useDiceStore()

  const containerRef    = useRef<HTMLDivElement>(null)
  const diceBoxRef      = useRef<any>(null)
  const initializingRef = useRef(false)
  const initializedRef  = useRef(false)
  // Context for the in-flight roll — set before calling box.roll(), read in onRollComplete
  const pendingRollCtxRef = useRef<{
    label: string
    modifier: number
    counts: Record<number, number>
    advMode: 'none' | 'advantage' | 'disadvantage'
  } | null>(null)

  const [counts, setCounts]       = useState<Record<number, number>>({})
  const [modifier, setModifier]   = useState(0)
  const [isRolling, setIsRolling] = useState(false)
  const [lastResult, setLastResult] = useState<RollResult | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diceVisible, setDiceVisible] = useState(false)
  const [advMode, setAdvMode] = useState<'none' | 'advantage' | 'disadvantage'>('none')

  const activeSet = getActiveSet()
  const allSets   = getAllSets()

  // ─── Initialize DiceBox (once, on first open) ───────────────────────────────
  useEffect(() => {
    if (!isOpen || initializedRef.current || initializingRef.current) return
    initializingRef.current = true

    ;(async () => {
      try {
        const { default: DiceBox } = await import('@3d-dice/dice-box-threejs')
        const box = new DiceBox('#dice-3d-container', {
          ...diceBoxConfig(activeSet),
          onRollComplete: (results: any) => {
            const ctx = pendingRollCtxRef.current
            if (!ctx) return
            pendingRollCtxRef.current = null

            // Library returns { notation, sets: [{ rolls: [{ sides, value, ... }] }], modifier, total }
            const dice: { sides: number; value: number }[] = []
            if (results?.sets && Array.isArray(results.sets)) {
              results.sets.forEach((set: any) => {
                if (set?.rolls && Array.isArray(set.rolls)) {
                  set.rolls.forEach((roll: any) => {
                    dice.push({ sides: roll.sides ?? 6, value: roll.value ?? 1 })
                  })
                }
              })
            }

            const d20s = dice.filter((d) => d.sides === 20)
            const nonD20Sum = dice.filter((d) => d.sides !== 20).reduce((s, d) => s + d.value, 0)
            const isAdvRoll = d20s.length === 2 && ctx.advMode !== 'none'
            const d20Pair: [number, number] | undefined = isAdvRoll ? [d20s[0].value, d20s[1].value] : undefined
            const effectiveD20 = isAdvRoll
              ? (ctx.advMode === 'advantage' ? Math.max(d20s[0].value, d20s[1].value) : Math.min(d20s[0].value, d20s[1].value))
              : (d20s.length === 1 ? d20s[0].value : null)
            const isSingleD20 = d20s.length === 1 || isAdvRoll
            const isCritSuccess = isSingleD20 && effectiveD20 === 20
            const isCritFailure = isSingleD20 && effectiveD20 === 1
            const d20Contribution = effectiveD20 ?? d20s.reduce((s, d) => s + d.value, 0)
            const rawSum = d20Contribution + nonD20Sum
            const total = (isCritSuccess || isCritFailure) ? rawSum : rawSum + ctx.modifier
            const notation = buildNotation(ctx.counts)
            const result: RollResult = {
              id: `${Date.now()}-${Math.random()}`,
              label: ctx.label,
              notation: ctx.modifier !== 0
                ? `${notation}${ctx.modifier >= 0 ? '+' : ''}${ctx.modifier}`
                : notation,
              dice,
              total,
              modifier: ctx.modifier,
              timestamp: Date.now(),
              critical: isCritSuccess ? 'success' : isCritFailure ? 'failure' : undefined,
              advantage: isAdvRoll && ctx.advMode !== 'none' ? ctx.advMode : undefined,
              d20Pair,
            }
            setLastResult(result)
            addRollResult(result)
            setIsRolling(false)

            // Auto-roll callback: fill the field and close
            const cb = useDiceStore.getState().onRollCompleteCallback
            if (cb) {
              setOnRollCompleteCallback(null)
              cb(total)
              setTimeout(() => close(), 600) // brief pause so user sees the result
            }
          },
        })
        await box.initialize()
        diceBoxRef.current = box
        initializedRef.current = true
      } catch (e) {
        console.error('DiceBox init failed:', e)
        initializingRef.current = false
      }
    })()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update config when dice set changes ────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current || !diceBoxRef.current) return
    try {
      diceBoxRef.current.updateConfig(diceBoxConfig(activeSet))
    } catch (e) {
      console.warn('DiceBox updateConfig failed:', e)
    }
  }, [activeDiceSetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handle pending roll triggered from character page / auto-roll ──────────
  useEffect(() => {
    if (!isOpen || !pendingRoll) return
    const { notation, label, modifier: mod, autoFire } = pendingRoll

    const newCounts: Record<number, number> = {}
    notation.split('+').forEach((part) => {
      const m = part.trim().match(/^(\d+)d(\d+)$/)
      if (m) newCounts[parseInt(m[2])] = (newCounts[parseInt(m[2])] || 0) + parseInt(m[1])
    })
    setCounts(newCounts)
    setModifier(mod)
    clearPendingRoll()

    if (autoFire) {
      // Wait for DiceBox to be ready, then fire automatically
      const tryFire = (attempts = 0) => {
        if (initializedRef.current && diceBoxRef.current) {
          pendingRollCtxRef.current = { label, modifier: mod, counts: newCounts, advMode: 'none' }
          setIsRolling(true)
          setDiceVisible(true)
          try { diceBoxRef.current.roll(notation) } catch { pendingRollCtxRef.current = null; setIsRolling(false); setDiceVisible(false) }
        } else if (attempts < 30) {
          setTimeout(() => tryFire(attempts + 1), 200)
        }
      }
      setTimeout(() => tryFire(), 150)
    }
  }, [isOpen, pendingRoll, clearPendingRoll])

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleAddDie = (sides: number) => {
    if (sides === 20 && advMode !== 'none') {
      setCounts((p) => ({ ...p, 20: 2 }))
    } else {
      setCounts((p) => ({ ...p, [sides]: (p[sides] || 0) + 1 }))
    }
  }

  const handleRemoveDie = (sides: number, e: React.MouseEvent) => {
    e.preventDefault()
    setCounts((p) => {
      const n = { ...p }
      if (n[sides] > 0) n[sides]--
      return n
    })
  }

  const toggleAdvMode = (mode: 'advantage' | 'disadvantage') => {
    const next = advMode === mode ? 'none' : mode
    setAdvMode(next)
    setCounts((p) => ({ ...p, 20: next !== 'none' ? 2 : Math.min(p[20] ?? 0, 1) }))
  }

  const handleReset = () => {
    setCounts({})
    setModifier(0)
    setAdvMode('none')
    setLastResult(null)
    setDiceVisible(false)
    try { diceBoxRef.current?.clear?.() } catch {}
  }

  const handlePickUpDice = () => {
    setDiceVisible(false)
    try { diceBoxRef.current?.clear?.() } catch {}
  }

  const handleRoll = useCallback(() => {
    const notation = buildNotation(counts)
    if (!notation || isRolling) return

    const label = pendingRoll?.label ?? notation

    if (diceBoxRef.current && initializedRef.current) {
      // Store context — onRollComplete will pick it up and build the result
      pendingRollCtxRef.current = { label, modifier, counts: { ...counts }, advMode }
      setIsRolling(true)
      setDiceVisible(true)
      try {
        diceBoxRef.current.roll(notation)
      } catch (e) {
        console.warn('DiceBox.roll() error:', e)
        pendingRollCtxRef.current = null
        setIsRolling(false)
      }
    } else {
      // Fallback: simulate locally when 3D box not ready
      const dice: { sides: number; value: number }[] = []
      Object.entries(counts).forEach(([sidesStr, count]) => {
        const sides = parseInt(sidesStr)
        for (let i = 0; i < count; i++)
          dice.push({ sides, value: Math.floor(Math.random() * sides) + 1 })
      })
      const d20s = dice.filter((d) => d.sides === 20)
      const nonD20Sum = dice.filter((d) => d.sides !== 20).reduce((s, d) => s + d.value, 0)
      const isAdvRoll = d20s.length === 2 && advMode !== 'none'
      const d20Pair: [number, number] | undefined = isAdvRoll ? [d20s[0].value, d20s[1].value] : undefined
      const effectiveD20 = isAdvRoll
        ? (advMode === 'advantage' ? Math.max(d20s[0].value, d20s[1].value) : Math.min(d20s[0].value, d20s[1].value))
        : (d20s.length === 1 ? d20s[0].value : null)
      const isSingleD20 = d20s.length === 1 || isAdvRoll
      const isCritSuccess = isSingleD20 && effectiveD20 === 20
      const isCritFailure = isSingleD20 && effectiveD20 === 1
      const d20Contribution = effectiveD20 ?? d20s.reduce((s, d) => s + d.value, 0)
      const rawSum = d20Contribution + nonD20Sum
      const total = (isCritSuccess || isCritFailure) ? rawSum : rawSum + modifier
      const result: RollResult = {
        id: `${Date.now()}-${Math.random()}`,
        label,
        notation: modifier !== 0 ? `${notation}${modifier >= 0 ? '+' : ''}${modifier}` : notation,
        dice, total, modifier, timestamp: Date.now(),
        critical: isCritSuccess ? 'success' : isCritFailure ? 'failure' : undefined,
        advantage: isAdvRoll ? advMode : undefined,
        d20Pair,
      }
      setLastResult(result)
      addRollResult(result)
    }
  }, [counts, modifier, isRolling, pendingRoll, addRollResult])

  const totalDice = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* ── Background dim ── */}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1400,
        bgcolor: 'rgba(8,6,4,0.96)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.2s ease',
      }} />

      {/* ── 3D canvas — zIndex ABOVE the control panel, pointer-events: none so clicks pass through ── */}
      <Box
        id="dice-3d-container"
        ref={containerRef}
        sx={{
          position: 'fixed', inset: 0, zIndex: 1403,
          pointerEvents: 'none',
          opacity: isOpen && diceVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* ── All UI — sits between dim and canvas in z-order ── */}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1401,
        display: 'flex', flexDirection: 'column',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none',
        transition: 'opacity 0.2s ease',
      }}>

        {/* ── Top bar ── */}
        <Box sx={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, pt: 1.5, pb: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CasinoIcon sx={{ color: '#c8a44a', fontSize: 20 }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '1rem' }}>
              Dice Roller
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Dice sets">
              <IconButton size="small" onClick={() => setSettingsOpen(true)}
                sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={close}
              sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* ── Dice set chips ── */}
        <Box sx={{ position: 'relative', zIndex: 1, px: 2, pb: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {allSets.map((s) => (
            <Chip key={s.id} label={s.name} size="small"
              onClick={() => setActiveDiceSet(s.id)}
              sx={{
                height: 22, fontSize: '0.7rem', cursor: 'pointer',
                bgcolor: s.id === activeSet.id ? 'rgba(200,164,74,0.2)' : 'rgba(120,108,92,0.1)',
                color: s.id === activeSet.id ? '#c8a44a' : '#786c5c',
                border: s.id === activeSet.id ? '1px solid rgba(200,164,74,0.4)' : '1px solid rgba(120,108,92,0.2)',
              }}
            />
          ))}
        </Box>

        {/* ── Roll result ── */}
        <Box sx={{
          position: 'relative', zIndex: 1,
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          {lastResult && (
            <Box sx={{ textAlign: 'center' }}>
              {lastResult.label !== lastResult.notation && (
                <Typography sx={{ color: '#786c5c', fontSize: '0.75rem', mb: 0.5, fontFamily: '"JetBrains Mono"' }}>
                  {lastResult.label}
                </Typography>
              )}
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.85rem', color: '#786c5c', mb: 0.5 }}>
                {lastResult.notation}
              </Typography>
              <Typography sx={{
                fontFamily: '"Cinzel", serif', fontSize: '3.5rem',
                color: lastResult.critical === 'success' ? '#f0d060' : lastResult.critical === 'failure' ? '#b84848' : '#c8a44a',
                lineHeight: 1,
                textShadow: lastResult.critical === 'success'
                  ? '0 0 40px rgba(240,208,96,0.8)'
                  : lastResult.critical === 'failure'
                    ? '0 0 40px rgba(184,72,72,0.8)'
                    : '0 0 30px rgba(200,164,74,0.5)',
              }}>
                {lastResult.total}
              </Typography>
              {lastResult.critical === 'success' && (
                <Typography sx={{
                  fontFamily: '"Cinzel", serif', fontSize: '1.1rem', color: '#f0d060', mt: 0.5,
                  textShadow: '0 0 24px rgba(240,208,96,0.7)', letterSpacing: 1,
                }}>
                  ✦ Critical Success!
                </Typography>
              )}
              {lastResult.critical === 'failure' && (
                <Typography sx={{
                  fontFamily: '"Cinzel", serif', fontSize: '1.1rem', color: '#b84848', mt: 0.5,
                  textShadow: '0 0 24px rgba(184,72,72,0.7)', letterSpacing: 1,
                }}>
                  ✗ Critical Failure!
                </Typography>
              )}
              {lastResult.d20Pair && (
                <Typography sx={{ color: '#786c5c', fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', mt: 0.5 }}>
                  [{lastResult.d20Pair[0]} / {lastResult.d20Pair[1]}]
                  {' '}
                  <span style={{ color: '#4a3f2e' }}>
                    {lastResult.advantage === 'advantage' ? '↑ highest' : '↓ lowest'}
                  </span>
                </Typography>
              )}
              {!lastResult.d20Pair && lastResult.dice.length > 1 && (
                <Typography sx={{ color: '#786c5c', fontSize: '0.72rem', fontFamily: '"JetBrains Mono"', mt: 0.5 }}>
                  [{lastResult.dice.map((d) => d.value).join(', ')}]
                  {lastResult.modifier !== 0 ? ` ${lastResult.modifier >= 0 ? '+' : ''}${lastResult.modifier}` : ''}
                </Typography>
              )}
              {diceVisible && (
                <Button size="small" onClick={handlePickUpDice} disabled={isRolling}
                  sx={{
                    mt: 1.5, color: '#4a3f2e', fontSize: '0.65rem',
                    fontFamily: '"JetBrains Mono"', textTransform: 'none',
                    border: '1px solid rgba(120,108,92,0.15)', borderRadius: 1, px: 1.5, py: 0.25,
                    '&:hover': { color: '#786c5c', borderColor: 'rgba(120,108,92,0.4)', bgcolor: 'transparent' },
                    '&:disabled': { color: '#2a2018', borderColor: 'rgba(120,108,92,0.08)' },
                  }}>
                  pick up dice
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* ── History strip ── */}
        {rollHistory.length > 1 && (
          <Box sx={{ position: 'relative', zIndex: 1, px: 2, pb: 1 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, mb: 0.5,
            }}>
              <Typography sx={{ fontSize: '0.62rem', color: '#4a3f2e', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
                History
              </Typography>
              <Tooltip title="Clear history">
                <IconButton size="small" onClick={clearHistory}
                  sx={{ color: '#4a3f2e', '&:hover': { color: '#786c5c' }, width: 18, height: 18 }}>
                  <RestartAltIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{
              display: 'flex', gap: 1, overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(120,108,92,0.3)' },
            }}>
              {rollHistory.slice(1).map((r) => (
                <Box key={r.id} sx={{
                  flexShrink: 0, textAlign: 'center', px: 1.5, py: 0.5,
                  bgcolor: 'rgba(17,16,9,0.7)', border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1,
                }}>
                  <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.65rem', color: '#786c5c' }}>
                    {r.notation}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1rem', color: '#b4a48a' }}>
                    {r.total}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Bottom control panel ── */}
        <Box sx={{
          position: 'relative', zIndex: 1,
          bgcolor: 'rgba(17,16,9,0.92)', borderTop: '1px solid rgba(120,108,92,0.3)',
          px: 2, pt: 2, pb: 3,
        }}>
          {/* Die picker */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1, sm: 2 }, mb: 2, flexWrap: 'wrap' }}>
            {DIE_TYPES.map((die) => {
              const count = counts[die.sides] || 0
              return (
                <Box key={die.sides}
                  onClick={() => handleAddDie(die.sides)}
                  onContextMenu={(e) => handleRemoveDie(die.sides, e)}
                  sx={{
                    position: 'relative', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                    p: 1, borderRadius: 1.5, userSelect: 'none',
                    bgcolor: count > 0 ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.06)',
                    border: count > 0 ? '1px solid rgba(200,164,74,0.4)' : '1px solid rgba(120,108,92,0.2)',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: 'rgba(200,164,74,0.18)', borderColor: 'rgba(200,164,74,0.5)', transform: 'translateY(-2px)' },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  {count > 0 && (
                    <Box sx={{
                      position: 'absolute', top: -8, right: -8,
                      width: 20, height: 20, borderRadius: '50%',
                      bgcolor: '#c8a44a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#0b0906', lineHeight: 1 }}>
                        {count}
                      </Typography>
                    </Box>
                  )}
                  <DieFaceIcon sides={die.sides} size={44} />
                  <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.7rem', color: count > 0 ? '#c8a44a' : '#786c5c' }}>
                    {die.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          {/* Advantage / Disadvantage toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1.5 }}>
            {(['advantage', 'disadvantage'] as const).map((mode) => {
              const active = advMode === mode
              const label = mode === 'advantage' ? 'ADV' : 'DIS'
              const color = mode === 'advantage' ? '#62a870' : '#b84848'
              const bg = mode === 'advantage' ? 'rgba(98,168,112,0.15)' : 'rgba(184,72,72,0.15)'
              const border = mode === 'advantage' ? 'rgba(98,168,112,0.5)' : 'rgba(184,72,72,0.5)'
              return (
                <Box key={mode} onClick={() => toggleAdvMode(mode)} sx={{
                  px: 1.5, py: 0.4, borderRadius: 1, cursor: 'pointer', userSelect: 'none',
                  border: `1px solid ${active ? border : 'rgba(120,108,92,0.2)'}`,
                  bgcolor: active ? bg : 'transparent',
                  color: active ? color : '#786c5c',
                  fontFamily: '"JetBrains Mono"', fontSize: '0.72rem', fontWeight: active ? 700 : 400,
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: border, color },
                }}>
                  {label}
                </Box>
              )
            })}
          </Box>

          {/* Modifier row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ color: '#786c5c', fontSize: '0.8rem' }}>MOD</Typography>
              <IconButton size="small" onClick={() => setModifier((m) => m - 1)}
                sx={{ color: '#786c5c', width: 24, height: 24, border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>−</Typography>
              </IconButton>
              <Typography sx={{
                fontFamily: '"JetBrains Mono"', fontSize: '0.95rem', minWidth: 32, textAlign: 'center',
                color: modifier !== 0 ? '#c8a44a' : '#786c5c',
              }}>
                {modifier >= 0 ? '+' : ''}{modifier}
              </Typography>
              <IconButton size="small" onClick={() => setModifier((m) => m + 1)}
                sx={{ color: '#786c5c', width: 24, height: 24, border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>+</Typography>
              </IconButton>
            </Box>
            {buildNotation(counts) && (
              <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.78rem', color: '#786c5c' }}>
                {buildNotation(counts)}{modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''}${modifier}` : ''}
              </Typography>
            )}
          </Box>

          <Typography sx={{ textAlign: 'center', color: '#3a3020', fontSize: '0.62rem', mb: 1.5 }}>
            right-click a die to remove one
          </Typography>

          {/* Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}
              disabled={totalDice === 0 && modifier === 0}
              sx={{
                color: '#786c5c', borderColor: 'rgba(120,108,92,0.4)', fontSize: '0.85rem', px: 3,
                '&:hover': { borderColor: '#786c5c', bgcolor: 'rgba(120,108,92,0.08)' },
              }}>
              Reset
            </Button>
            <Button variant="contained" onClick={handleRoll}
              disabled={totalDice === 0 || isRolling}
              sx={{
                bgcolor: '#c8a44a', color: '#0b0906', fontSize: '0.95rem',
                fontWeight: 700, px: 4, fontFamily: '"Cinzel", serif',
                '&:hover': { bgcolor: '#d4b05a' },
                '&:disabled': { bgcolor: 'rgba(200,164,74,0.2)', color: '#786c5c' },
              }}>
              {isRolling ? 'Rolling…' : 'Roll'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Dice set manager — zIndex must beat 1400 */}
      <DiceSetManager open={settingsOpen} onClose={() => setSettingsOpen(false)} localOnly={localOnly} />
    </>
  )
}
