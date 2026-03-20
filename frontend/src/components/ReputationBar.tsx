import { Box, Typography, IconButton } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

interface Props {
  name: string
  reputation: number
  repMin: number
  repMax: number
  readonly?: boolean
  onDelta?: (delta: number) => void
}

export default function ReputationBar({ name, reputation, repMin, repMax, readonly, onDelta }: Props) {
  const range = repMax - repMin
  const steps = Array.from({ length: range + 1 }, (_, i) => repMin + i)

  const segmentColor = (val: number) => {
    if (val < 0 && val <= reputation) return '#b84848'
    if (val > 0 && val <= reputation) return '#62a870'
    if (val === 0) return reputation === 0 ? '#786c5c' : '#3a332a'
    return '#3a332a'
  }

  const label = (rep: number) => {
    if (rep >= 3) return 'Honored'
    if (rep >= 2) return 'Friendly'
    if (rep >= 1) return 'Cordial'
    if (rep === 0) return 'Neutral'
    if (rep >= -1) return 'Wary'
    if (rep >= -2) return 'Hostile'
    return 'Enemy'
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ color: '#b4a48a', fontSize: '0.85rem' }}>
          {name}
        </Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#786c5c' }}>
          {label(reputation)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {!readonly && (
          <IconButton size="small" onClick={() => onDelta?.(-1)} disabled={reputation <= repMin}
            sx={{ p: 0.25, color: '#b84848' }}>
            <RemoveIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}

        <Box sx={{ display: 'flex', gap: 0.5, flex: 1, justifyContent: 'center' }}>
          {steps.map((val) => (
            <Box
              key={val}
              sx={{
                width: 20,
                height: 20,
                borderRadius: 0.5,
                backgroundColor: segmentColor(val),
                border: val === 0 ? '1px solid #786c5c60' : '1px solid transparent',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {val === 0 && (
                <Box sx={{ width: 4, height: 4, bgcolor: '#786c5c', borderRadius: '50%' }} />
              )}
            </Box>
          ))}
        </Box>

        {!readonly && (
          <IconButton size="small" onClick={() => onDelta?.(1)} disabled={reputation >= repMax}
            sx={{ p: 0.25, color: '#62a870' }}>
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
