import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Chip, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Autocomplete,
} from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import { useTranscription, type TranscriptSegment } from '../hooks/useTranscription'

const SPEAKER_COLORS = ['#c8a44a', '#62a870', '#6ea8d4', '#c87050', '#a862a8', '#a8c862']

function speakerColor(speakerId: number | null) {
  if (speakerId === null) return '#786c5c'
  return SPEAKER_COLORS[speakerId % SPEAKER_COLORS.length]
}

interface Props {
  sessionId: string
  campaignCharacters: string[]
  dmName: string
  initialSegments?: TranscriptSegment[]
}

export default function TranscriptPanel({ sessionId, campaignCharacters, dmName, initialSegments = [] }: Props) {
  const [showCleanOnly, setShowCleanOnly] = useState(false)
  const [assigningName, setAssigningName] = useState('')
  const [language, setLanguage] = useState<'es' | 'en' | 'multi'>('es')

  const { isRecording, segments, unknownSpeaker, start, stop, assignName } =
    useTranscription(sessionId, initialSegments, language)
  const scrollRef = useRef<HTMLDivElement>(null)

    const displayed = showCleanOnly
    ? segments.filter((s) => s.isGameRelated)
    : segments


  // When new segments arrive, only scroll to top if already at top
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop === 0) el.scrollTop = 0 // already there, no-op keeps anchor
    // If user scrolled down, do nothing — maintain their position
  }, [displayed.length])

  const speakerOptions = [`${dmName} (DM)`, ...campaignCharacters]


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontFamily: '"Cinzel"', fontSize: '0.8rem', color: '#786c5c', flex: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
          Session Transcript
        </Typography>
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.5, borderRadius: 1,
            bgcolor: 'rgba(184,72,72,0.12)', border: '1px solid rgba(184,72,72,0.4)' }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: '#b84848',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              animation: 'pulse 1.2s ease-in-out infinite',
            }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#b84848', fontFamily: '"JetBrains Mono"' }}>
              REC
            </Typography>
          </Box>
        )}
        <Box component="select" value={language} onChange={(e: any) => setLanguage(e.target.value)}
          disabled={isRecording}
          sx={{ bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c', borderRadius: 0.5, px: 0.75, py: 0.25, fontSize: '0.72rem', cursor: isRecording ? 'not-allowed' : 'pointer', '&:focus': { outline: 'none' } }}>
          <option value="es">ES</option>
          <option value="en">EN</option>
          <option value="multi">Auto</option>
        </Box>
        <Tooltip title={showCleanOnly ? 'Show all dialogue' : 'Show game-only'}>
          <IconButton size="small" onClick={() => setShowCleanOnly((v) => !v)}
            sx={{ color: showCleanOnly ? '#c8a44a' : '#786c5c' }}>
            {showCleanOnly ? <FilterAltIcon fontSize="small" /> : <FilterAltOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant={isRecording ? 'contained' : 'outlined'}
          startIcon={isRecording ? <MicOffIcon /> : <MicIcon />}
          onClick={isRecording ? stop : start}
          sx={isRecording
            ? { bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' }, fontSize: '0.75rem' }
            : { borderColor: 'rgba(98,168,112,0.5)', color: '#62a870', '&:hover': { borderColor: '#62a870' }, fontSize: '0.75rem' }
          }>
          {isRecording ? 'Stop' : 'Record'}
        </Button>
      </Box>

      {/* Segments — newest first */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: 0.75, overflowAnchor: 'none' }}>
        {displayed.length === 0 && (
          <Typography sx={{ fontSize: '0.75rem', color: '#4a4235', fontStyle: 'italic', mt: 1 }}>
            {isRecording ? 'Waiting for speech...' : 'Start recording to capture the session.'}
          </Typography>
        )}
        {displayed.map((seg) => (
          <SegmentRow key={seg.id} seg={seg} showClean={showCleanOnly} />
        ))}
      </Box>

      {/* Speaker assignment dialog */}
      <Dialog open={unknownSpeaker !== null} onClose={() => {}} slotProps={{ paper: { sx: { bgcolor: '#1a1712', border: '1px solid rgba(120,108,92,0.3)' } } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel"', color: '#c8a44a', fontSize: '1rem' }}>
          New Speaker Detected
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: '#b0a090', mb: 2 }}>
            Speaker {unknownSpeaker} just started talking. Who is this?
          </Typography>
          <Autocomplete
            freeSolo
            options={speakerOptions}
            value={assigningName}
            onInputChange={(_, v) => setAssigningName(v)}
            renderInput={(params) => (
              <TextField {...params} label="Name" size="small"
                sx={{ '& .MuiInputBase-root': { bgcolor: '#111009' } }} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => { if (unknownSpeaker !== null) assignName(unknownSpeaker, `Speaker ${unknownSpeaker}`) }}
            sx={{ color: '#786c5c' }}>
            Skip
          </Button>
          <Button size="small" variant="contained" disabled={!assigningName}
            onClick={() => { if (unknownSpeaker !== null && assigningName) { assignName(unknownSpeaker, assigningName); setAssigningName('') } }}
            sx={{ bgcolor: '#c8a44a', '&:hover': { bgcolor: '#d4b05a' }, color: '#111' }}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function SegmentRow({ seg, showClean }: { seg: TranscriptSegment; showClean: boolean }) {
  const text = showClean && seg.cleanText ? seg.cleanText : seg.rawText
  const label = seg.speakerName ?? (seg.speakerId !== null ? `Speaker ${seg.speakerId}` : '?')
  const color = speakerColor(seg.speakerId)

  return (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
      <Chip label={label} size="small"
        sx={{ bgcolor: 'transparent', border: `1px solid ${color}`, color, fontSize: '0.65rem', height: 20, flexShrink: 0, mt: 0.25 }} />
      <Typography sx={{ fontSize: '0.8rem', color: seg.isGameRelated ? '#c8bca8' : '#5a5040', lineHeight: 1.5 }}>
        {text}
      </Typography>
    </Box>
  )
}
