import React from 'react'
import { Card, CardContent, Box, Typography, LinearProgress, Tooltip } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ShieldIcon from '@mui/icons-material/Shield'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { slideUp } from '../utils/motion'
import StatusBadge from './StatusBadge'

const STAT_ABBR: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
  STR: 'STR', DEX: 'DEX', CON: 'CON', INT: 'INT', WIS: 'WIS', CHA: 'CHA',
}
const STAT_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

function modStr(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

interface Character {
  id: string
  name: string
  role: string
  status: string
  hpCurrent?: number | null
  hpMax?: number | null
  armorClass?: number | null
  speed?: number | null
  corruptionStage: number
  corruptionMax: number
  miniPrinted: boolean
  location?: string | null
  portraitUrl?: string | null
  stats?: Record<string, number> | null
  tags?: string[]
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

  const statEntries = character.stats
    ? STAT_ORDER.filter((k) => character.stats![k] != null)
        .slice(0, 6)
        .map((k) => ({ abbr: STAT_ABBR[k], score: character.stats![k] }))
    : []

  return (
    <motion.div variants={slideUp}>
    <Card
      onClick={handleClick}
      sx={{
        cursor: 'pointer', p: 0,
        bgcolor: '#111009',
        border: '1px solid rgba(120,108,92,0.2)',
        '&:hover': { borderColor: 'rgba(120,108,92,0.45)' },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
          {character.portraitUrl && (
            <Box component="img" src={character.portraitUrl} alt={character.name}
              sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', objectPosition: 'top', flexShrink: 0, mr: 1.25, border: '1px solid rgba(120,108,92,0.25)' }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.95rem', color: '#e6d8c0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {character.name}
              </Typography>
              {character.miniPrinted && (
                <Tooltip title="Mini printed">
                  <PrintIcon sx={{ fontSize: 12, color: '#62a870', flexShrink: 0 }} />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={character.role} />
              {character.location && (
                <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.66rem' }}>
                  {character.location}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0, ml: 0.5, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            {actions && <Box sx={{ display: 'flex', gap: 0.25 }}>{actions}</Box>}
            <StatusBadge status={character.status} />
          </Box>
        </Box>

        {/* HP bar */}
        {character.hpMax != null && hpPct !== null && (
          <Box sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <FavoriteIcon sx={{ fontSize: 9, color: hpColor(hpPct) }} />
                <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', color: hpColor(hpPct) }}>
                  {character.hpCurrent ?? 0}/{character.hpMax}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                {character.armorClass && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ShieldIcon sx={{ fontSize: 9, color: '#786c5c' }} />
                    <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>AC {character.armorClass}</Typography>
                  </Box>
                )}
                {character.speed && (
                  <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{character.speed} ft.</Typography>
                )}
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={hpPct * 100}
              sx={{ height: 3, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.2)', '& .MuiLinearProgress-bar': { backgroundColor: hpColor(hpPct), borderRadius: 1 } }}
            />
          </Box>
        )}

        {/* Ability scores */}
        {statEntries.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mt: 0.25 }}>
            {statEntries.map(({ abbr, score }) => (
              <Box key={abbr} sx={{ textAlign: 'center', px: 0.6, py: 0.2, bgcolor: '#0b0906', borderRadius: 0.5, border: '1px solid rgba(120,108,92,0.2)', minWidth: 34 }}>
                <Typography sx={{ fontSize: '0.56rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{abbr}</Typography>
                <Typography sx={{ fontSize: '0.82rem', color: '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>{score}</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{modStr(score)}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Corruption dots */}
        {character.corruptionMax > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {Array.from({ length: character.corruptionMax }, (_, i) => (
              <Box key={i} sx={{
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: i < character.corruptionStage ? '#b84848' : '#3a332a',
                border: '1px solid #6e303060',
              }} />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
    </motion.div>
  )
}
