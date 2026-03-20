import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  CircularProgress, Alert, List, ListItem, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  MenuItem, Select, FormControl, InputLabel,
} from '@mui/material'
import { useState, useEffect, useRef, useCallback } from 'react'
import StopIcon from '@mui/icons-material/Stop'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import SaveIcon from '@mui/icons-material/Save'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TimerIcon from '@mui/icons-material/Timer'
import { useSessionStore } from '../store/session'
import HPTracker from '../components/HPTracker'
import ConditionBadge from '../components/ConditionBadge'
import StatusBadge from '../components/StatusBadge'

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
      id name role status hpMax hpCurrent armorClass speed
    }
  }
`

const START_SESSION = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) { id status }
  }
`

const END_SESSION = gql`
  mutation EndSession($id: ID!, $playerSummary: String) {
    endSession(id: $id, playerSummary: $playerSummary) { id status endedAt }
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
  const [note, setNote] = useState('')
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [playerSummaryEnd, setPlayerSummaryEnd] = useState('')

  // Role filter — default show all non-player roles for active, all for completed
  const [roleFilter, setRoleFilter] = useState<string[]>([])

  // ── Timer ────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedAtRef = useRef<number | null>(null)
  const pausedOffsetRef = useRef(0) // accumulated ms of paused time

  const { characterStates, initCharacter, setHP } = useSessionStore()

  const { data, loading, error, refetch } = useQuery(SESSION, { variables: { id }, skip: !id })
  const session = data?.session
  const sessionStatus = session?.status?.toUpperCase()
  const isActive = sessionStatus === 'ACTIVE'
  const isCompleted = sessionStatus === 'COMPLETED'
  const timerStarted = !!session?.startedAt

  const campaignId = session?.campaign?.id

  const { data: charsData } = useQuery(CAMPAIGN_CHARS, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const [endSession] = useMutation(END_SESSION)
  const [updateSession] = useMutation(UPDATE_SESSION)
  const [startSession] = useMutation(START_SESSION)
  const [addNote] = useMutation(ADD_NOTE)
  const [updateHP] = useMutation(UPDATE_HP)

  // Tick — only when active, timer started, and not paused
  useEffect(() => {
    if (!isActive || !session?.startedAt || paused) return
    const startedMs = new Date(session.startedAt).getTime()
    const tick = () => setElapsed(Date.now() - startedMs - pausedOffsetRef.current)
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, session?.startedAt, paused])

  // For completed sessions compute final duration once
  useEffect(() => {
    if (isCompleted && session?.startedAt && session?.endedAt) {
      setElapsed(new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime())
    }
  }, [isCompleted, session?.startedAt, session?.endedAt])

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
    if (paused) {
      // resuming: accumulate how long we were paused
      if (pausedAtRef.current !== null) {
        pausedOffsetRef.current += Date.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
    } else {
      pausedAtRef.current = Date.now()
    }
    setPaused((p) => !p)
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
    await endSession({ variables: { id, playerSummary: playerSummaryEnd || undefined } })
    navigate('/dashboard')
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
    <Box>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              {formatElapsed(elapsed)}
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
            <Typography variant="h6" sx={{ color: '#c8a44a' }}>Characters</Typography>
            <ToggleButtonGroup
              value={roleFilter}
              onChange={(_, v) => setRoleFilter(v)}
              size="small"
              sx={{
                flexWrap: 'wrap',
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

          <Grid container spacing={1.5}>
            {filteredChars.map((c: { id: string; name: string; role: string; status: string; hpMax?: number | null; armorClass?: number | null; speed?: number | null }) => {
              const storeState = characterStates[c.id]
              const hpCurrent = storeState?.hpCurrent ?? 0
              const conditions = storeState?.conditions ?? []

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
                      </Box>

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
      </Grid>

      {/* End session dialog */}
      <Dialog open={endDialogOpen} onClose={() => setEndDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(200,164,74,0.3)', minWidth: 400 } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a' }}>End Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: '#0b0906', borderRadius: 1 }}>
            <TimerIcon sx={{ fontSize: 16, color: '#c8a44a' }} />
            <Typography sx={{ fontFamily: '"JetBrains Mono"', color: '#c8a44a', fontSize: '1rem' }}>
              {formatElapsed(elapsed)}
            </Typography>
            <Typography sx={{ color: '#786c5c', fontSize: '0.8rem' }}>session duration</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#b4a48a', mb: 2 }}>
            Write a player-facing summary of what happened this session. This will be visible in the player share link.
          </Typography>
          <TextField
            fullWidth multiline rows={5}
            label="Player Summary"
            value={playerSummaryEnd}
            onChange={(e) => setPlayerSummaryEnd(e.target.value)}
            placeholder="The party crossed the Galebring Ford and discovered..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEndDialogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleEndSession}>End Session</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
