import { useState, useRef } from 'react'
import { Badge, IconButton, Tooltip } from '@mui/material'
import CasinoIcon from '@mui/icons-material/Casino'
import { useDiceStore } from '../store/dice'

type SnapPos = 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-right'
const FAB_SIZE = 52
const FAB_MARGIN = 20

function snapSx(pos: SnapPos) {
  const m = `${FAB_MARGIN}px`
  switch (pos) {
    case 'top-left':     return { top: m,    left:  m,    bottom: 'auto', right: 'auto' }
    case 'top-right':    return { top: m,    right: m,    bottom: 'auto', left:  'auto' }
    case 'center-left':  return { top: '50%', left: m,    bottom: 'auto', right: 'auto', transform: 'translateY(-50%)' }
    case 'center-right': return { top: '50%', right: m,   bottom: 'auto', left:  'auto', transform: 'translateY(-50%)' }
    case 'bottom-left':  return { bottom: m, left:  m,    top:    'auto', right: 'auto' }
    case 'bottom-right': return { bottom: m, right: m,    top:    'auto', left:  'auto' }
  }
}

function nearestSnap(x: number, y: number): SnapPos {
  const W = window.innerWidth, H = window.innerHeight, s = FAB_SIZE, m = FAB_MARGIN
  const candidates: [SnapPos, number, number][] = [
    ['top-left',     m,           m],
    ['top-right',    W - m - s,   m],
    ['center-left',  m,           (H - s) / 2],
    ['center-right', W - m - s,   (H - s) / 2],
    ['bottom-left',  m,           H - m - s],
    ['bottom-right', W - m - s,   H - m - s],
  ]
  return candidates.reduce((b, c) =>
    Math.hypot(x - c[1], y - c[2]) < Math.hypot(x - b[1], y - b[2]) ? c : b
  )[0]
}

export default function DiceFab() {
  const { open: openDice, rollHistory } = useDiceStore()
  const lastRoll = rollHistory[0]
  const [snapPos, setSnapPos] = useState<SnapPos>(() =>
    (localStorage.getItem('dice-fab-pos') as SnapPos | null) ?? 'bottom-right'
  )
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const originRef = useRef<{ cx: number; cy: number; bx: number; by: number } | null>(null)
  const dragXYRef = useRef<{ x: number; y: number } | null>(null)

  const isDragging = dragXY !== null

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    hasDraggedRef.current = false
    originRef.current = { cx: e.clientX, cy: e.clientY, bx: rect.left, by: rect.top }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!originRef.current) return
    const dx = e.clientX - originRef.current.cx
    const dy = e.clientY - originRef.current.cy
    if (Math.hypot(dx, dy) > 5) hasDraggedRef.current = true
    if (!hasDraggedRef.current) return
    const x = Math.max(0, Math.min(window.innerWidth  - FAB_SIZE, originRef.current.bx + dx))
    const y = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, originRef.current.by + dy))
    dragXYRef.current = { x, y }
    setDragXY({ x, y })
  }

  const handlePointerUp = () => {
    if (!originRef.current) return
    if (hasDraggedRef.current && dragXYRef.current) {
      const snap = nearestSnap(dragXYRef.current.x, dragXYRef.current.y)
      setSnapPos(snap)
      localStorage.setItem('dice-fab-pos', snap)
    } else {
      openDice()
    }
    dragXYRef.current = null
    originRef.current = null
    setDragXY(null)
  }

  return (
    <Tooltip title={isDragging ? '' : 'Dice Roller'} placement="left">
      <IconButton
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          position: 'fixed',
          ...(isDragging
            ? { left: dragXY!.x, top: dragXY!.y, bottom: 'auto', right: 'auto', transform: 'none', cursor: 'grabbing', zIndex: 1400 }
            : { ...snapSx(snapPos), cursor: 'grab', zIndex: 1300, transition: 'top 0.22s ease, bottom 0.22s ease, left 0.22s ease, right 0.22s ease' }
          ),
          width: FAB_SIZE, height: FAB_SIZE, borderRadius: '50%',
          touchAction: 'none', userSelect: 'none',
          bgcolor: 'rgba(17,16,9,0.95)', border: '1px solid rgba(200,164,74,0.4)',
          color: '#c8a44a', boxShadow: isDragging ? '0 8px 32px rgba(0,0,0,0.8)' : '0 4px 20px rgba(0,0,0,0.6)',
          '&:hover': { bgcolor: 'rgba(200,164,74,0.12)', borderColor: '#c8a44a' },
        }}
      >
        <Badge
          badgeContent={lastRoll ? lastRoll.total : null}
          sx={{ '& .MuiBadge-badge': { bgcolor: '#c8a44a', color: '#0b0906', fontSize: '0.55rem', minWidth: 16, height: 16, fontFamily: '"JetBrains Mono"', fontWeight: 700 } }}
        >
          <CasinoIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}
