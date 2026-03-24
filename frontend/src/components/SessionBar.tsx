import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography, Button, IconButton, Tooltip, useTheme, useMediaQuery } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useRecordingStore } from '../store/recording'

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const pulseKeyframe = {
  '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
  animation: 'pulse 1.2s ease-in-out infinite',
}

export default function SessionBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeSessionId, sessionNumber, sessionName, elapsed, isRecording, segments } =
    useRecordingStore()
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (!activeSessionId || location.pathname === `/session/${activeSessionId}`) return null

  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.6,
        mb: 2,
        borderRadius: 1,
        bgcolor: '#111009',
        border: '1px solid rgba(200,164,74,0.25)',
        borderLeft: '3px solid #c8a44a',
        minWidth: 0,
        mt: isMobile ? 2 : 0
      }}
    >
      {/* REC dot */}
      {isRecording && (
        <Box
          sx={{
            width: 7, height: 7, borderRadius: '50%', bgcolor: '#b84848',
            flexShrink: 0, ...pulseKeyframe,
          }}
        />
      )}

      {/* Session label — hide long name on mobile */}
      <Typography
        sx={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.78rem',
          color: '#c8a44a',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        S{sessionNumber ?? '—'}
        {/* Show full name only on md+ */}
        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
          {sessionName ? ` — ${sessionName}` : ''}
        </Box>
      </Typography>

      {/* Timer */}
      <Typography
        sx={{
          fontFamily: '"JetBrains Mono"',
          fontSize: '0.78rem',
          color: '#786c5c',
          flexShrink: 0,
        }}
      >
        {formatElapsed(elapsed)}
      </Typography>

      {/* Last transcribed line — desktop only */}
      {lastSegment && (
        <Typography
          sx={{
            display: { xs: 'none', md: 'block' },
            fontSize: '0.73rem',
            color: '#4a4235',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: 'italic',
            minWidth: 0,
          }}
        >
          {lastSegment.speakerName ? `${lastSegment.speakerName}: ` : ''}
          "{lastSegment.rawText}"
        </Typography>
      )}

      {/* Spacer on mobile */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flex: 1 }} />

      {/* Back to session — icon only on mobile, full button on desktop */}
      <Tooltip title="Back to Session">
        <Box>
          {/* Mobile: icon button */}
          <IconButton
            size="small"
            onClick={() => navigate(`/session/${activeSessionId}`)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              color: '#c8a44a',
              border: '1px solid rgba(200,164,74,0.4)',
              borderRadius: 1,
              p: 0.5,
              '&:hover': { borderColor: '#c8a44a', bgcolor: 'rgba(200,164,74,0.06)' },
            }}
          >
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {/* Desktop: full button */}
          <Button
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: '0.85rem !important' }} />}
            onClick={() => navigate(`/session/${activeSessionId}`)}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              fontSize: '0.75rem',
              color: '#c8a44a',
              borderColor: 'rgba(200,164,74,0.4)',
              border: '1px solid',
              borderRadius: 1,
              px: 1.25,
              py: 0.25,
              flexShrink: 0,
              '&:hover': { borderColor: '#c8a44a', bgcolor: 'rgba(200,164,74,0.06)' },
            }}
          >
            Back to Session
          </Button>
        </Box>
      </Tooltip>
    </Box>
  )
}
