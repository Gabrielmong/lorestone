import { Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { motion } from 'framer-motion'

const CONDITION_COLORS: Record<string, string> = {
  frightened:  '#7c3c7c',
  prone:       '#4a4a4a',
  poisoned:    '#2d5a2d',
  stunned:     '#7a6820',
  paralyzed:   '#305868',
  blinded:     '#5a3a3a',
  deafened:    '#4a3a20',
  charmed:     '#7c4a6a',
  exhausted:   '#6e3030',
  restrained:  '#3a4a3a',
  incapacitated: '#6e4430',
}

interface Props {
  condition: string
  onRemove?: () => void
}

export default function ConditionBadge({ condition, onRemove }: Props) {
  const bg = CONDITION_COLORS[condition.toLowerCase()] ?? '#3a332a'

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.15 } }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
      layout
    >
    <Chip
      label={condition}
      size="small"
      onDelete={onRemove}
      deleteIcon={onRemove ? <CloseIcon style={{ fontSize: 12 }} /> : undefined}
      sx={{
        backgroundColor: bg,
        color: '#e6d8c0',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.68rem',
        height: 20,
        '& .MuiChip-deleteIcon': { color: '#e6d8c0aa', '&:hover': { color: '#e6d8c0' } },
      }}
    />
    </motion.span>
  )
}
