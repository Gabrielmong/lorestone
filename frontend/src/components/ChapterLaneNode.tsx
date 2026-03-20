import { memo } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

export const ACT_COLORS = [
  '#4a8fb5',
  '#a06db5',
  '#b5734a',
  '#4ab57e',
  '#b54a6e',
  '#4ab5b5',
  '#8fb54a',
]

interface LaneData {
  label: string
  colorIndex: number
  height: number
  width: number
  playerVisible?: boolean
  onToggleVisibility?: () => void
}

export default memo(function ChapterLaneNode({ data }: { data: LaneData }) {
  const color = ACT_COLORS[data.colorIndex % ACT_COLORS.length]
  return (
    <Box sx={{
      width: data.width,
      height: data.height,
      bgcolor: `${color}07`,
      borderLeft: `2px solid ${color}30`,
      position: 'relative',
      pointerEvents: 'none',
    }}>
      <Box sx={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 0.5, pointerEvents: 'auto' }}>
        <Typography sx={{
          fontSize: '0.72rem',
          color: `${color}60`,
          fontFamily: '"Cinzel", serif',
          fontWeight: 600,
          letterSpacing: 0.8,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          lineHeight: 1,
        }}>
          {data.label}
        </Typography>
        {data.onToggleVisibility !== undefined && (
          <Tooltip title={data.playerVisible ? 'Visible to players — click to hide' : 'Hidden from players — click to show'}>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); data.onToggleVisibility!() }}
              sx={{ p: 0.25, color: data.playerVisible ? `${color}80` : 'rgba(120,108,92,0.3)', '&:hover': { color } }}
            >
              {data.playerVisible
                ? <VisibilityIcon sx={{ fontSize: 13 }} />
                : <VisibilityOffIcon sx={{ fontSize: 13 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
})
