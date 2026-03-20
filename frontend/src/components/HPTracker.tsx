import { Box, Typography, IconButton, LinearProgress, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { useState } from 'react'

interface Props {
  characterId: string
  current: number
  max: number
  onChange: (hp: number) => void
}

function hpColor(pct: number) {
  if (pct > 0.5) return '#62a870'
  if (pct > 0.25) return '#c8a44a'
  return '#b84848'
}

export default function HPTracker({ characterId, current, max, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(current))

  const pct = max > 0 ? Math.max(0, current / max) : 0
  const color = hpColor(pct)

  const clamp = (v: number) => Math.max(0, Math.min(max, v))

  const adjust = (delta: number) => onChange(clamp(current + delta))

  const commitInput = () => {
    const parsed = parseInt(inputVal, 10)
    if (!isNaN(parsed)) onChange(clamp(parsed))
    setEditing(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <IconButton size="small" onClick={() => adjust(-5)} sx={{ color: '#b84848', p: 0.25 }}>
          <RemoveIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" onClick={() => adjust(-1)} sx={{ color: '#b4a48a', p: 0.25 }}>
          <RemoveIcon sx={{ fontSize: 12 }} />
        </IconButton>

        {editing ? (
          <TextField
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitInput}
            onKeyDown={(e) => e.key === 'Enter' && commitInput()}
            size="small"
            autoFocus
            inputProps={{ style: { textAlign: 'center', width: 48, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', padding: '2px 4px' } }}
            sx={{ '& .MuiOutlinedInput-root': { height: 24 } }}
          />
        ) : (
          <Typography
            onClick={() => { setEditing(true); setInputVal(String(current)) }}
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.9rem',
              color,
              cursor: 'pointer',
              minWidth: 60,
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {current}/{max}
          </Typography>
        )}

        <IconButton size="small" onClick={() => adjust(1)} sx={{ color: '#b4a48a', p: 0.25 }}>
          <AddIcon sx={{ fontSize: 12 }} />
        </IconButton>
        <IconButton size="small" onClick={() => adjust(5)} sx={{ color: '#62a870', p: 0.25 }}>
          <AddIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <LinearProgress
        variant="determinate"
        value={pct * 100}
        sx={{
          height: 4,
          '& .MuiLinearProgress-bar': { backgroundColor: color },
        }}
      />
    </Box>
  )
}
