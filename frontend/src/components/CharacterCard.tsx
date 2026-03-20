import React from 'react'
import { Card, CardContent, Box, Typography, LinearProgress, Tooltip } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { slideUp } from '../utils/motion'
import StatusBadge from './StatusBadge'

interface Character {
  id: string
  name: string
  role: string
  status: string
  hpCurrent?: number | null
  hpMax?: number | null
  corruptionStage: number
  corruptionMax: number
  miniPrinted: boolean
  location?: string | null
}

interface Props {
  character: Character
  onClick?: () => void
  actions?: React.ReactNode
}

function hpColor(pct: number) {
  if (pct > 0.5) return '#62a870'
  if (pct > 0.25) return '#c8a44a'
  return '#b84848'
}

export default function CharacterCard({ character, onClick, actions }: Props) {
  const navigate = useNavigate()
  const hpPct = character.hpMax ? (character.hpCurrent ?? 0) / character.hpMax : null
  const handleClick = onClick ?? (() => navigate(`/characters/${character.id}`))

  return (
    <motion.div variants={slideUp}>
    <Card
      onClick={handleClick}
      sx={{ cursor: 'pointer', p: 0 }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
          <Typography
            variant="body1"
            sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.95rem', color: '#e6d8c0', fontWeight: 600 }}
          >
            {character.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {character.miniPrinted && (
              <Tooltip title="Mini printed">
                <PrintIcon sx={{ fontSize: 14, color: '#62a870' }} />
              </Tooltip>
            )}
            {actions && (
              <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                {actions}
              </Box>
            )}
            <StatusBadge status={character.status} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75 }}>
          <StatusBadge status={character.role} />
          {character.location && (
            <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.68rem' }}>
              {character.location}
            </Typography>
          )}
        </Box>

        {hpPct !== null && character.hpMax && (
          <Box sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: hpColor(hpPct) }}>
                HP {character.hpCurrent}/{character.hpMax}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={hpPct * 100}
              sx={{ height: 3, '& .MuiLinearProgress-bar': { backgroundColor: hpColor(hpPct) } }}
            />
          </Box>
        )}

        {character.corruptionMax > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
            {Array.from({ length: character.corruptionMax }, (_, i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: i < character.corruptionStage ? '#b84848' : '#3a332a',
                  border: '1px solid #6e303060',
                }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
    </motion.div>
  )
}
