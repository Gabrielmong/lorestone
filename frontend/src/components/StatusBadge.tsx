import { Chip } from '@mui/material'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#3d6b4a', color: '#62a870' },
  DEAD:      { bg: '#6e3030', color: '#b84848' },
  PENDING:   { bg: '#305868', color: '#5090b0' },
  UNKNOWN:   { bg: '#3a332a', color: '#786c5c' },
  RESOLVED:  { bg: '#3a2e14', color: '#c8a44a' },
  PLANNED:   { bg: '#3a332a', color: '#786c5c' },
  COMPLETED: { bg: '#3a2e14', color: '#c8a44a' },
  SKIPPED:   { bg: '#3a332a', color: '#786c5c' },
  NPC:       { bg: '#305868', color: '#5090b0' },
  VILLAIN:   { bg: '#6e3030', color: '#b84848' },
  MONSTER:   { bg: '#6e3030', color: '#b84848' },
  ALLY:      { bg: '#3d6b4a', color: '#62a870' },
  PLAYER:    { bg: '#3a2e14', color: '#c8a44a' },
  NEUTRAL:   { bg: '#3a332a', color: '#786c5c' },
  GOOD:      { bg: '#3d6b4a', color: '#62a870' },
  BAD:       { bg: '#6e3030', color: '#b84848' },
  VARIABLE:  { bg: '#305868', color: '#5090b0' },
}

interface Props {
  status: string
  size?: 'small' | 'medium'
}

export default function StatusBadge({ status, size = 'small' }: Props) {
  const colors = STATUS_COLORS[status?.toUpperCase()] ?? STATUS_COLORS['UNKNOWN']
  return (
    <Chip
      label={status?.toLowerCase().replace('_', ' ')}
      size={size}
      sx={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        height: size === 'small' ? 20 : 28,
        border: `1px solid ${colors.color}40`,
      }}
    />
  )
}
