import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  CircularProgress, Alert, List, ListItem, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  MenuItem, Select, FormControl, InputLabel, Collapse, IconButton,
  useTheme, useMediaQuery,
} from '@mui/material'
import { useState, useEffect, useRef, useCallback } from 'react'
import StopIcon from '@mui/icons-material/Stop'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import SaveIcon from '@mui/icons-material/Save'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TimerIcon from '@mui/icons-material/Timer'
import EditNoteIcon from '@mui/icons-material/EditNote'
import { useSessionStore } from '../store/session'
import { useDiceStore } from '../store/dice'
import { useAuthStore } from '../store/auth'
import { useRecordingStore } from '../store/recording'
import { recordingService } from '../services/recordingService'
import HPTracker from '../components/HPTracker'
import ConditionBadge from '../components/ConditionBadge'
import StatusBadge from '../components/StatusBadge'
import TranscriptPanel from '../components/TranscriptPanel'

const SPEAKER_COLORS = ['#c8a44a', '#62a870', '#6ea8d4', '#c87050', '#a862a8', '#a8c862']
function CompletedTranscript({ segments }: { segments: any[] }) {
  const gameOnly = segments.filter((s) => s.isGameRelated)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
      <Typography sx={{ fontFamily: '"Cinzel"', fontSize: '0.8rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1 }}>
        Session Transcript
      </Typography>
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: 0.75 }}>
        {gameOnly.map((seg: any) => {
          const color = SPEAKER_COLORS[(seg.speakerId ?? 0) % SPEAKER_COLORS.length]
          const label = seg.speakerName ?? `Speaker ${seg.speakerId ?? '?'}`
          return (
            <Box key={seg.id} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
              <Chip label={label} size="small" sx={{ bgcolor: 'transparent', border: `1px solid ${color}`, color, fontSize: '0.65rem', height: 20, flexShrink: 0, mt: 0.25 }} />
              <Typography sx={{ fontSize: '0.8rem', color: '#c8bca8', lineHeight: 1.5 }}>
                {seg.cleanText ?? seg.rawText}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

const SESSION = gql`
  query SessionActive($id: ID!) {
    session(id: $id) {
      id sessionNumber title status dmNotes playerSummary startedAt endedAt
      chapter { id name }
      campaign { id chapters { id name } }
      characterStates { id character { id name } hpCurrent conditions status }
      events { id eventType description createdAt }
    }
  }
`

const CAMPAIGN_CHARS = gql`
  query SessionChars($campaignId: ID!) {
    characters(campaignId: $campaignId) {
      id name role status hpMax hpCurrent armorClass speed stats extra
    }
  }
`

const START_SESSION = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) { id status startedAt }
  }
`

const END_SESSION = gql`
  mutation EndSession($id: ID!, $playerSummary: String) {
    endSession(id: $id, playerSummary: $playerSummary) { id status endedAt }
  }
`

const GENERATE_SUMMARY = gql`
  mutation GenerateSessionSummary($sessionId: ID!) {
    generateSessionSummary(sessionId: $sessionId) { playerSummary dmNotes }
  }
`

const TRANSCRIPT_SEGMENTS = gql`
  query TranscriptSegments($sessionId: ID!) {
    transcriptSegments(sessionId: $sessionId) { id speakerName speakerId rawText cleanText isGameRelated startTime }
  }
`

const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) { id dmNotes playerSummary chapter { id name } }
  }
`

const ADD_NOTE = gql`
  mutation AddNote($sessionId: ID!, $note: String!) {
    addSessionNote(sessionId: $sessionId, note: $note) { id description createdAt }
  }
`

const UPDATE_HP = gql`
  mutation UpdateHP($id: ID!, $hpCurrent: Int!) {
    updateCharacterHP(id: $id, hpCurrent: $hpCurrent) { id hpCurrent }
  }
`

const LOG_ROLL = gql`
  mutation SessionLogRoll($input: LogRollInput!) { logRoll(input: $input) { id } }
`

const ALL_ROLES = ['player', 'npc', 'monster', 'ally', 'villain', 'neutral']

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}


export default function SessionActive() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [charsCollapsed, setCharsCollapsed] = useState(false)
  const [note, setNote] = useState('')
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [playerSummaryEnd, setPlayerSummaryEnd] = useState('')
  const [dmNotesEnd, setDmNotesEnd] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // Role filter — default to Player
  const [roleFilter, setRoleFilter] = useState<string[]>(['player'])

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { characterStates, initCharacter, setHP } = useSessionStore()
  const { setActiveSession: setDiceActiveSession, clearActiveSession: clearDiceActiveSession } = useDiceStore()
  const { user } = useAuthStore()
  const {
    elapsed, paused, pauseTimer, resumeTimer,
    setActiveSession: setRecordingSession, clearActiveSession: clearRecordingSession,
    isRecording,
  } = useRecordingStore()

  // Track whether we've registered this session — avoids re-registration when
  // clearRecordingSession() changes the store mid-render while isActive is still true
  const sessionRegisteredRef = useRef(false)
  useEffect(() => { sessionRegisteredRef.current = false }, [id])

  const { data, loading, error, refetch } = useQuery(SESSION, { variables: { id }, skip: !id })
  const session = data?.session
  const sessionStatus = session?.status?.toUpperCase()
  const isActive = sessionStatus === 'ACTIVE'
  const isCompleted = sessionStatus === 'COMPLETED'
  const timerStarted = !!session?.startedAt

  const campaignId = session?.campaign?.id

  // Track active session in dice store so DiceRoller can auto-log rolls
  useEffect(() => {
    if (isActive && id && campaignId) setDiceActiveSession(id, campaignId)
    else clearDiceActiveSession()
    return () => clearDiceActiveSession()
  }, [isActive, id, campaignId])

  const { data: charsData } = useQuery(CAMPAIGN_CHARS, {
    variables: { campaignId },
    skip: !campaignId,
    fetchPolicy: 'network-only',
  })

  const [endSession] = useMutation(END_SESSION)
  const [generateSummary] = useMutation(GENERATE_SUMMARY)
  const [updateSession] = useMutation(UPDATE_SESSION)
  const [startSession] = useMutation(START_SESSION)
  const [addNote] = useMutation(ADD_NOTE)
  const [updateHP] = useMutation(UPDATE_HP)
  const [logRollMutation] = useMutation(LOG_ROLL)

  // Manual roll log
  const [rollLogOpen, setRollLogOpen] = useState(false)
  const [rlCharacter, setRlCharacter] = useState('')
  const [rlLabel, setRlLabel] = useState('')
  const [rlDiceType, setRlDiceType] = useState('d20')
  const [rlResult, setRlResult] = useState('')
  const [rlModifier, setRlModifier] = useState('0')

  // Register session in recording store when data is ready (only once per session)
  const { data: transcriptData } = useQuery(TRANSCRIPT_SEGMENTS, { variables: { sessionId: id }, skip: !id, fetchPolicy: 'network-only' })
  useEffect(() => {
    if (!session || !id || !transcriptData || !charsData) return
    if (!isActive) return
    if (sessionRegisteredRef.current) return // already registered
    setRecordingSession({
      id,
      sessionNumber: session.sessionNumber ?? null,
      sessionName: session.title ?? null,
      startedAt: session.startedAt ?? null,
      campaignCharacters: (charsData.characters ?? []).map((c: { name: string }) => c.name),
      dmName: user?.name ?? 'DM',
      initialSegments: transcriptData.transcriptSegments ?? [],
    })
    sessionRegisteredRef.current = true
  }, [session?.id, !!transcriptData, !!charsData, isActive])

  // For completed sessions show final duration
  const [completedElapsed, setCompletedElapsed] = useState(0)
  useEffect(() => {
    if (isCompleted && session?.startedAt && session?.endedAt) {
      setCompletedElapsed(new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime())
    }
  }, [isCompleted, session?.startedAt, session?.endedAt])

  const displayElapsed = isCompleted ? completedElapsed : elapsed

  // Default role filter based on session status
  useEffect(() => {
    if (session && roleFilter.length === 0) {
      if (isActive) {
        setRoleFilter(['monster', 'villain', 'npc', 'ally'])
      } else {
        setRoleFilter(ALL_ROLES)
      }
    }
  }, [session, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inline notes state synced from server
  const [dmNotes, setDmNotes] = useState('')
  const [playerSummary, setPlayerSummary] = useState('')

  useEffect(() => {
    if (session) {
      setDmNotes(session.dmNotes ?? '')
      setPlayerSummary(session.playerSummary ?? '')
    }
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => {
    if (paused) resumeTimer()
    else pauseTimer()
  }

  useEffect(() => {
    if (charsData?.characters) {
      for (const c of charsData.characters) {
        if (!characterStates[c.id]) {
          initCharacter(c.id, c.hpCurrent ?? c.hpMax ?? 0, [])
        }
      }
    }
  }, [charsData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveHPs = async () => {
    for (const [charId, state] of Object.entries(characterStates)) {
      await updateHP({ variables: { id: charId, hpCurrent: state.hpCurrent } })
    }
  }

  const handleAddNote = async () => {
    if (!note.trim() || !id) return
    await addNote({ variables: { sessionId: id, note } })
    setNote('')
    refetch()
  }

  const saveField = useCallback(async (field: 'dmNotes' | 'playerSummary', value: string) => {
    if (!id) return
    await updateSession({ variables: { id, input: { [field]: value } } })
  }, [id, updateSession])

  const handleEndSession = async () => {
    if (!id) return
    if (isRecording) recordingService.stop(id)
    clearRecordingSession()
    await endSession({ variables: { id, playerSummary: playerSummaryEnd || undefined } })
    if (dmNotesEnd) await updateSession({ variables: { id, input: { dmNotes: dmNotesEnd } } })
    navigate('/dashboard')
  }

  const handleGenerateSummary = async () => {
    if (!id) return
    setGeneratingSummary(true)
    try {
      const res = await generateSummary({ variables: { sessionId: id } })
      const { playerSummary, dmNotes } = res.data.generateSessionSummary
      if (playerSummary) setPlayerSummaryEnd(playerSummary)
      if (dmNotes) setDmNotesEnd(dmNotes)
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleLogManualRoll = async () => {
    const total = parseInt(rlResult)
    if (!rlCharacter || isNaN(total) || !campaignId) return
    const mod = parseInt(rlModifier) || 0
    const base = total - mod
    const critical = rlDiceType === 'd20' && base === 20 ? 'nat20' : rlDiceType === 'd20' && base === 1 ? 'nat1' : undefined
    await logRollMutation({
      variables: {
        input: {
          campaignId,
          sessionId: id,
          characterName: rlCharacter,
          notation: `1${rlDiceType}${mod >= 0 ? '+' : ''}${mod}`,
          diceType: rlDiceType,
          individualRolls: [base],
          modifier: mod,
          total,
          label: rlLabel || rlDiceType.toUpperCase(),
          ...(critical && { critical }),
        },
      },
    })
    setRlResult('')
    setRollLogOpen(false)
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  if (!session) return null

  const characters = charsData?.characters ?? []
  const filteredChars = roleFilter.length > 0
    ? characters.filter((c: { role: string }) => roleFilter.includes(c.role.toLowerCase()))
    : characters
  const events = [...(session.events ?? [])].reverse()

  return (
    <Box sx={{ pb: { xs: isActive ? '72px' : 0, md: 0 }, pt: isMobile ? 1 : 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">
            Session {session.sessionNumber}
            {session.title && ` — ${session.title}`}
          </Typography>
          <FormControl size="small" sx={{ mt: 0.75, minWidth: 180 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Chapter</InputLabel>
            <Select
              label="Chapter"
              value={session.chapter?.id ?? ''}
              onChange={(e) => {
                if (!id) return
                updateSession({ variables: { id, input: { chapterId: e.target.value || null } } })
              }}
              sx={{ fontSize: '0.82rem', color: '#786c5c' }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {(session.campaign?.chapters ?? []).map((ch: { id: string; name: string }) => (
                <MenuItem key={ch.id} value={ch.id}>{ch.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5 }}>
          {/* Duration display */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 0.75, bgcolor: '#111009',
            border: `1px solid ${isActive && timerStarted && !paused ? 'rgba(200,164,74,0.4)' : 'rgba(120,108,92,0.4)'}`,
            borderRadius: 1,
          }}>
            <TimerIcon sx={{ fontSize: 16, color: isActive && timerStarted && !paused ? '#c8a44a' : '#786c5c' }} />
            <Typography sx={{
              fontFamily: '"JetBrains Mono"', fontSize: '1.1rem', minWidth: 56, textAlign: 'center',
              color: isActive && timerStarted && !paused ? '#c8a44a' : '#786c5c',
            }}>
              {formatElapsed(displayElapsed)}
            </Typography>
            {isActive && !timerStarted && (
              <Button size="small" onClick={() => startSession({ variables: { id } })} sx={{ minWidth: 0, p: 0.25, color: '#62a870' }}>
                <PlayArrowIcon sx={{ fontSize: 16 }} />
              </Button>
            )}
            {isActive && timerStarted && (
              <Button size="small" onClick={togglePause} sx={{ minWidth: 0, p: 0.25, color: paused ? '#62a870' : '#786c5c' }}>
                {paused ? <PlayArrowIcon sx={{ fontSize: 16 }} /> : <PauseIcon sx={{ fontSize: 16 }} />}
              </Button>
            )}
          </Box>

          {sessionStatus === 'PLANNED' && (
            <Button variant="contained" startIcon={<PlayArrowIcon />}
              onClick={() => startSession({ variables: { id } })}
              size="small" color="success">
              Begin Session
            </Button>
          )}
          {isActive && (
            <>
              <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveHPs} size="small">
                Save HP
              </Button>
              <Button variant="outlined" startIcon={<EditNoteIcon />} onClick={() => setRollLogOpen(true)} size="small"
                sx={{ borderColor: 'rgba(120,108,92,0.4)', color: '#786c5c' }}>
                Log Roll
              </Button>
              <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={() => setEndDialogOpen(true)} size="small">
                End Session
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* Characters */}
        <Grid item xs={12} lg={7}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="h6" sx={{ color: '#c8a44a' }}>Characters</Typography>
              <IconButton size="small" onClick={() => setCharsCollapsed((v) => !v)} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
                {charsCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <ToggleButtonGroup
              value={roleFilter}
              onChange={(_, v) => setRoleFilter(v)}
              size="small"
              sx={{
                flexWrap: { xs: 'nowrap', md: 'wrap' },
                '& .MuiToggleButton-root': {
                  color: '#786c5c', borderColor: 'rgba(120,108,92,0.3)', px: 1, py: 0.25,
                  fontSize: '0.7rem', textTransform: 'capitalize',
                  '&.Mui-selected': { color: '#c8a44a', bgcolor: 'rgba(200,164,74,0.1)', borderColor: 'rgba(200,164,74,0.4)' },
                },
              }}
            >
              {ALL_ROLES.map((r) => (
                <ToggleButton key={r} value={r}>{r}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            </Box>
          </Box>

          <Collapse in={!charsCollapsed}>
          <Grid container spacing={1.5}>
            {filteredChars.map((c: { id: string; name: string; role: string; status: string; hpMax?: number | null; armorClass?: number | null; speed?: number | null; stats?: Record<string, number> | null; extra?: unknown }) => {
              const storeState = characterStates[c.id]
              const hpCurrent = storeState?.hpCurrent ?? 0
              const conditions = storeState?.conditions ?? []

              const extra = c.extra
                ? (typeof c.extra === 'string' ? JSON.parse(c.extra) : c.extra) as Record<string, unknown>
                : null

              const STAT_KEYS = [
                { key: 'STR', label: 'STR' },
                { key: 'DEX', label: 'DEX' },
                { key: 'CON', label: 'CON' },
                { key: 'INT', label: 'INT' },
                { key: 'WIS', label: 'WIS' },
                { key: 'CHA', label: 'CHA' },
              ]
              const hasStats = c.stats && Object.keys(c.stats).length > 0
              const wisMod = c.stats?.WIS != null ? Math.floor((c.stats.WIS - 10) / 2) : null
              const passivePerception = extra?.passivePerception != null
                ? Number(extra.passivePerception)
                : wisMod != null ? 10 + wisMod : null
              const initiative = extra?.initiative != null
                ? Number(extra.initiative)
                : c.stats?.DEX != null ? Math.floor((c.stats.DEX - 10) / 2) : null

              return (
                <Grid item xs={12} sm={6} key={c.id}>
                  <Card>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#e6d8c0' }}>
                          {c.name}
                        </Typography>
                        <StatusBadge status={c.status} />
                      </Box>

                      {c.hpMax && (
                        <Box sx={{ mb: 1 }}>
                          <HPTracker
                            characterId={c.id}
                            current={hpCurrent}
                            max={c.hpMax}
                            onChange={(hp) => setHP(c.id, hp)}
                          />
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        {c.armorClass && (
                          <Chip label={`AC ${c.armorClass}`} size="small" sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', bgcolor: '#305868', color: '#5090b0', height: 18 }} />
                        )}
                        {c.speed && (
                          <Chip label={`${c.speed}ft`} size="small" sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', bgcolor: '#1a160f', color: '#786c5c', height: 18 }} />
                        )}
                        {passivePerception != null && (
                          <Chip label={`PP ${passivePerception}`} size="small" sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', bgcolor: '#1a1a0f', color: '#a89060', height: 18 }} />
                        )}
                        {initiative != null && (
                          <Chip label={`Init ${initiative >= 0 ? '+' : ''}${initiative}`} size="small" sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', bgcolor: '#1a160f', color: '#786c5c', height: 18 }} />
                        )}
                      </Box>

                      {hasStats && (
                        <Box sx={{ display: 'flex', gap: 0, mt: 0.5, mb: 0.5, border: '1px solid rgba(120,108,92,0.15)', borderRadius: 1, overflow: 'hidden' }}>
                          {STAT_KEYS.map(({ key, label }) => {
                            const score = c.stats?.[key] ?? 0
                            const mod = Math.floor((score - 10) / 2)
                            const modStr = mod >= 0 ? `+${mod}` : `${mod}`
                            return (
                              <Box key={key} sx={{ flex: 1, textAlign: 'center', py: 0.4, borderRight: '1px solid rgba(120,108,92,0.15)', '&:last-child': { borderRight: 'none' } }}>
                                <Typography sx={{ fontSize: '0.55rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>{label}</Typography>
                                <Typography sx={{ fontSize: '0.75rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', fontWeight: 'bold', lineHeight: 1.3 }}>{modStr}</Typography>
                                <Typography sx={{ fontSize: '0.55rem', color: '#5c5040', fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>{score}</Typography>
                              </Box>
                            )
                          })}
                        </Box>
                      )}

                      {conditions.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {conditions.map((cond) => (
                            <ConditionBadge key={cond} condition={cond} />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
          </Collapse>

          {/* DM Notes + Player Summary — inline, save on blur */}
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth multiline minRows={4}
              label="DM Notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              onBlur={() => saveField('dmNotes', dmNotes)}
              placeholder="Private notes for the DM..."
              slotProps={{ input: { readOnly: isCompleted } }}
            />
            <TextField
              fullWidth multiline minRows={4}
              label="Player Summary"
              value={playerSummary}
              onChange={(e) => setPlayerSummary(e.target.value)}
              onBlur={() => saveField('playerSummary', playerSummary)}
              placeholder="What happened this session (visible to players)..."
              slotProps={{ input: { readOnly: isCompleted } }}
            />
          </Box>
        </Grid>

        {/* Event log + note */}
        <Grid item xs={12} lg={5}>
          <Typography variant="h6" sx={{ mb: 1.5, color: '#c8a44a' }}>Event Log</Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Add a session note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              size="small"
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <Button variant="outlined" size="small" onClick={handleAddNote} startIcon={<NoteAddIcon />}>
              Add
            </Button>
          </Box>

          <List disablePadding sx={{ maxHeight: '60vh', overflow: 'auto' }}>
            {events.map((ev: { id: string; eventType: string; description?: string | null; createdAt: string }) => (
              <ListItem key={ev.id} sx={{ px: 0, py: 0.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: '100%', p: 1, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Chip
                      label={ev.eventType.toLowerCase().replace('_', ' ')}
                      size="small"
                      sx={{ bgcolor: '#1a160f', color: '#786c5c', fontFamily: '"JetBrains Mono"', fontSize: '0.65rem', height: 18 }}
                    />
                    <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.65rem', fontFamily: '"JetBrains Mono"' }}>
                      {new Date(ev.createdAt).toLocaleTimeString()}
                    </Typography>
                  </Box>
                  {ev.description && (
                    <Typography variant="body2" sx={{ color: '#b4a48a', fontSize: '0.82rem' }}>
                      {ev.description}
                    </Typography>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        </Grid>

        {/* Transcript — live when active, read-only when completed */}
        {(isActive || (isCompleted && transcriptData?.transcriptSegments?.length > 0)) && (
          <Grid item xs={12}>
            <Box sx={{ p: 2, bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1, height: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isActive ? (
                <TranscriptPanel />
              ) : (
                <CompletedTranscript segments={transcriptData?.transcriptSegments ?? []} />
              )}
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Manual Roll Log Dialog */}
      <Dialog open={rollLogOpen} onClose={() => setRollLogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', pb: 0.5 }}>
          Log Physical Roll
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Select
                value={rlCharacter} onChange={(e) => setRlCharacter(e.target.value as string)}
                displayEmpty size="small" fullWidth renderValue={(v) => v || 'Character / Player'}>
                <MenuItem value={`${user?.name ?? 'DM'} (DM)`}>{user?.name ?? 'DM'} (DM)</MenuItem>
                {(charsData?.characters ?? []).map((c: { id: string; name: string }) => (
                  <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Label (e.g. Perception Check)" value={rlLabel}
                onChange={(e) => setRlLabel(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Die</InputLabel>
                <Select label="Die" value={rlDiceType} onChange={(e) => setRlDiceType(e.target.value as string)}>
                  {['d4','d6','d8','d10','d12','d20','d100'].map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3.5}>
              <TextField label="Modifier" type="number" value={rlModifier}
                onChange={(e) => setRlModifier(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={3.5}>
              <TextField label="Total" type="number" value={rlResult}
                onChange={(e) => setRlResult(e.target.value)} fullWidth size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setRollLogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={handleLogManualRoll} variant="contained" size="small" disabled={!rlCharacter || !rlResult}>
            Log Roll
          </Button>
        </DialogActions>
      </Dialog>

      {/* End session dialog */}
      <Dialog open={endDialogOpen} onClose={() => setEndDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(200,164,74,0.3)' } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a' }}>End Session</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#0b0906', borderRadius: 1 }}>
            <TimerIcon sx={{ fontSize: 16, color: '#c8a44a' }} />
            <Typography sx={{ fontFamily: '"JetBrains Mono"', color: '#c8a44a', fontSize: '1rem' }}>
              {formatElapsed(displayElapsed)}
            </Typography>
            <Typography sx={{ color: '#786c5c', fontSize: '0.8rem' }}>session duration</Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" onClick={handleGenerateSummary} disabled={generatingSummary}
              sx={{ borderColor: 'rgba(200,164,74,0.4)', color: '#c8a44a', fontSize: '0.7rem' }}>
              {generatingSummary ? 'Generating...' : '✦ AI Summary'}
            </Button>
          </Box>
          <TextField
            fullWidth multiline rows={8}
            label="Player Summary"
            value={playerSummaryEnd}
            onChange={(e) => setPlayerSummaryEnd(e.target.value)}
            placeholder="The party crossed the Galebring Ford and discovered..."
            helperText="Visible to players in the share link"
          />
          <TextField
            fullWidth multiline rows={8}
            label="DM Notes"
            value={dmNotesEnd}
            onChange={(e) => setDmNotesEnd(e.target.value)}
            placeholder="Key events, decisions, plot threads..."
            helperText="Private — only visible to you"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEndDialogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleEndSession}>End Session</Button>
        </DialogActions>
      </Dialog>

      {/* Mobile fixed bottom bar */}
      <Box sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
        bgcolor: '#111009', borderTop: '1px solid rgba(120,108,92,0.3)',
        px: 1.5, py: 1, gap: 1, alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, bgcolor: '#111009', border: `1px solid ${isActive && timerStarted && !paused ? 'rgba(200,164,74,0.4)' : 'rgba(120,108,92,0.3)'}`, borderRadius: 1 }}>
          <TimerIcon sx={{ fontSize: 14, color: isActive && timerStarted && !paused ? '#c8a44a' : '#786c5c' }} />
          <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.9rem', color: isActive && timerStarted && !paused ? '#c8a44a' : '#786c5c' }}>
            {formatElapsed(displayElapsed)}
          </Typography>
          {isActive && timerStarted && (
            <IconButton size="small" onClick={togglePause} sx={{ p: 0.25, color: paused ? '#62a870' : '#786c5c' }}>
              {paused ? <PlayArrowIcon sx={{ fontSize: 14 }} /> : <PauseIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          )}
        </Box>
        {sessionStatus === 'PLANNED' && (
          <Button variant="contained" startIcon={<PlayArrowIcon />}
            onClick={() => startSession({ variables: { id } })}
            size="small" color="success" sx={{ flex: 1 }}>
            Begin
          </Button>
        )}
        {isActive && (
          <>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveHPs} size="small" sx={{ flex: 1 }}>
              Save HP
            </Button>
            <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={() => setEndDialogOpen(true)} size="small" sx={{ flex: 1 }}>
              End
            </Button>
          </>
        )}
      </Box>
    </Box>
  )
}
