import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import CheckIcon from '@mui/icons-material/Check'

export interface DecisionNodeData {
  id: string
  question: string
  status: string
  missionName?: string | null
  chapterName?: string | null
  chapterColorIndex: number
  isRoot: boolean
  isLocked: boolean
  branches: Array<{
    id: string
    label: string
    outcomeType: string
    isChosen: boolean
  }>
}

const ACT_COLORS = [
  '#4a8fb5', // Act 1 — ice blue
  '#a06db5', // Act 2 — violet
  '#b5734a', // Act 3 — copper
  '#4ab57e', // Act 4 — sage
  '#b54a6e', // Act 5 — rose
  '#4ab5b5', // Act 6 — teal
  '#8fb54a', // Act 7 — lime
]

const OUTCOME_COLOR: Record<string, string> = {
  GOOD: '#62a870',
  BAD: '#b84848',
  NEUTRAL: '#786c5c',
  VARIABLE: '#c8a44a',
}

const STATUS_BORDER: Record<string, string> = {
  ACTIVE: '#c8a44a',
  RESOLVED: '#62a870',
  PENDING: 'rgba(120,108,92,0.4)',
  SKIPPED: 'rgba(120,108,92,0.2)',
}

export default memo(function DecisionTreeNode({ data }: { data: DecisionNodeData }) {
  const border = STATUS_BORDER[data.status] ?? 'rgba(120,108,92,0.3)'
  const isResolved = data.status === 'RESOLVED'
  const actColor = data.chapterColorIndex >= 0 ? ACT_COLORS[data.chapterColorIndex % ACT_COLORS.length] : null

  return (
    <Box
      sx={{
        width: 260,
        bgcolor: '#111009',
        border: `2px solid ${border}`,
        borderRadius: 1.5,
        overflow: 'hidden',
        boxShadow: isResolved ? `0 0 12px ${border}30` : undefined,
        opacity: data.status === 'SKIPPED' ? 0.5 : 1,
        // Left stripe for act/chapter color
        borderLeft: actColor ? `4px solid ${actColor}` : `2px solid ${border}`,
      }}
    >
      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: border, border: 'none', width: 8, height: 8 }}
      />
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'rgba(120,108,92,0.5)', border: 'none', width: 8, height: 8 }}
      />

      {/* Header */}
      <Box sx={{
        px: 1.5, py: 0.75,
        bgcolor: '#0b0906',
        borderBottom: '1px solid rgba(120,108,92,0.25)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.missionName ?? data.chapterName ?? '—'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
          {data.isLocked && <LockIcon sx={{ fontSize: 11, color: '#786c5c' }} />}
          <Box sx={{
            px: 0.75, py: 0.1, borderRadius: 0.5, fontSize: '0.58rem',
            fontFamily: '"JetBrains Mono"', fontWeight: 700,
            bgcolor: `${border}20`, color: border,
          }}>
            {data.status}
          </Box>
        </Box>
      </Box>

      {/* Question */}
      <Box sx={{ px: 1.5, py: 1, minHeight: 36 }}>
        <Typography sx={{
          fontSize: '0.78rem', color: '#e6d8c0', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {data.question}
        </Typography>
      </Box>

      {/* Branches */}
      {data.branches.length > 0 && (
        <Box sx={{ borderTop: '1px solid rgba(120,108,92,0.2)', px: 1.5, pt: 0.5, pb: 0.75 }}>
          {data.branches.map((b) => (
            <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.2 }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                bgcolor: b.isChosen ? OUTCOME_COLOR[b.outcomeType] ?? '#786c5c' : 'transparent',
                border: `1.5px solid ${b.isChosen ? OUTCOME_COLOR[b.outcomeType] ?? '#786c5c' : 'rgba(120,108,92,0.4)'}`,
              }} />
              <Typography sx={{
                fontSize: '0.68rem',
                color: b.isChosen ? (OUTCOME_COLOR[b.outcomeType] ?? '#c8a44a') : '#786c5c',
                fontWeight: b.isChosen ? 600 : 400,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {b.label}
              </Typography>
              {b.isChosen && <CheckIcon sx={{ fontSize: 10, color: OUTCOME_COLOR[b.outcomeType] ?? '#62a870', flexShrink: 0 }} />}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
})
