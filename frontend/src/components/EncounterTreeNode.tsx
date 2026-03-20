import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography } from '@mui/material'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'

export interface EncounterNodeData {
  id: string
  name: string
  status: string
  round: number
  outcomeType?: string | null
  participantCount: number
}

const OUTCOME_COLOR: Record<string, string> = {
  WIN: '#62a870',
  LOSS: '#b84848',
  FLEE: '#c8a44a',
  DRAW: '#786c5c',
}

const STATUS_BORDER: Record<string, string> = {
  ACTIVE: '#e05a5a',
  COMPLETED: 'rgba(120,108,92,0.6)',
  PENDING: 'rgba(120,108,92,0.3)',
}

export default memo(function EncounterTreeNode({ data }: { data: EncounterNodeData }) {
  const border = STATUS_BORDER[data.status] ?? 'rgba(120,108,92,0.3)'
  const outcomeColor = data.outcomeType ? OUTCOME_COLOR[data.outcomeType] : null

  return (
    <Box sx={{
      width: 200,
      bgcolor: '#160a0a',
      border: `2px solid ${border}`,
      borderLeft: '4px solid #b84848',
      borderRadius: 1.5,
      overflow: 'hidden',
      opacity: data.status === 'PENDING' ? 0.7 : 1,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: 'rgba(180,72,72,0.5)', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: 'rgba(180,72,72,0.5)', border: 'none', width: 8, height: 8 }} />

      <Box sx={{
        px: 1.5, py: 0.75, bgcolor: '#1a0909',
        borderBottom: '1px solid rgba(180,72,72,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#b84848' }} />
          <Typography sx={{ fontSize: '0.6rem', color: '#b84848', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase' }}>
            Encounter
          </Typography>
        </Box>
        <Box sx={{
          px: 0.75, py: 0.1, borderRadius: 0.5, fontSize: '0.55rem',
          fontFamily: '"JetBrains Mono"', fontWeight: 700,
          bgcolor: `${border}20`, color: border,
        }}>
          {data.status === 'ACTIVE' ? `RND ${data.round}` : data.status}
        </Box>
      </Box>

      <Box sx={{ px: 1.5, py: 0.75 }}>
        <Typography sx={{ fontSize: '0.78rem', color: '#e6d8c0', fontWeight: 600, lineHeight: 1.3 }}>
          {data.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>
            {data.participantCount} combatants
          </Typography>
          {outcomeColor && (
            <Box sx={{
              px: 0.5, py: 0.1, borderRadius: 0.5,
              bgcolor: `${outcomeColor}20`, color: outcomeColor,
              fontSize: '0.6rem', fontFamily: '"JetBrains Mono"', fontWeight: 700,
            }}>
              {data.outcomeType}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
})
