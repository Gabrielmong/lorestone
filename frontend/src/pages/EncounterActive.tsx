import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Button, CircularProgress, Alert, Grid,
  Chip, IconButton, TextField, Select, MenuItem, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Divider, LinearProgress, Autocomplete, InputLabel,
} from '@mui/material'
import { useCampaign } from '../context/campaign'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import AddIcon from '@mui/icons-material/Add'
import FavoriteIcon from '@mui/icons-material/Favorite'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import RemoveIcon from '@mui/icons-material/Remove'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'

const ENCOUNTER = gql`
  query EncounterActive($id: ID!) {
    encounter(id: $id) {
      id name description status round currentTurnIndex outcomeType outcome
      linkedDecision { id question }
      outcomeDecision { id question }
      startedAt endedAt
      participants {
        id name isPlayer initiative hpMax hpCurrent armorClass conditions isActive
        killedByName killedDescription notes
        character { id name }
      }
    }
  }
`

const NEXT_TURN = gql`
  mutation NextTurn($id: ID!) { nextTurn(encounterId: $id) { id round currentTurnIndex } }
`
const PREV_TURN = gql`
  mutation PrevTurn($id: ID!) { prevTurn(encounterId: $id) { id round currentTurnIndex } }
`
const UPDATE_PARTICIPANT = gql`
  mutation UpdateParticipant($id: ID!, $input: UpdateParticipantInput!) {
    updateParticipant(id: $id, input: $input) {
      id hpCurrent hpMax conditions isActive killedByName killedDescription notes
    }
  }
`
const ADD_PARTICIPANT = gql`
  mutation AddParticipant($encounterId: ID!, $input: CreateParticipantInput!) {
    addParticipant(encounterId: $encounterId, input: $input) { id name initiative }
  }
`
const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($id: ID!) { removeParticipant(id: $id) }
`
const UPDATE_CHARACTER_STATUS = gql`
  mutation UpdateCharacterStatus($id: ID!, $status: CharacterStatus!) {
    updateCharacterStatus(id: $id, status: $status) { id status }
  }
`

const END_ENCOUNTER = gql`
  mutation EndEncounter($id: ID!, $outcomeType: EncounterOutcome!, $outcome: String) {
    endEncounter(id: $id, outcomeType: $outcomeType, outcome: $outcome) { id status outcomeType }
  }
`

const CAMPAIGN_CHARS = gql`
  query EncounterChars($campaignId: ID!) {
    characters(campaignId: $campaignId) {
      id name role hpMax hpCurrent armorClass
    }
  }
`

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated',
  'Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']

type Participant = {
  id: string; name: string; isPlayer: boolean; initiative: number
  hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null
  conditions: string[]; isActive: boolean
  killedByName?: string | null; killedDescription?: string | null
  notes?: string | null
  character?: { id: string; name: string } | null
}

type CampaignChar = { id: string; name: string; role: string; hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null }

export default function EncounterActive() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaignId } = useCampaign()

  const { data, loading, error } = useQuery(ENCOUNTER, {
    variables: { id },
    skip: !id,
    pollInterval: 5000,
  })

  const [nextTurn] = useMutation(NEXT_TURN, { refetchQueries: ['EncounterActive'] })
  const [prevTurn] = useMutation(PREV_TURN, { refetchQueries: ['EncounterActive'] })
  const [updateParticipant] = useMutation(UPDATE_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [addParticipant, { loading: addingP }] = useMutation(ADD_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [updateCharacterStatus] = useMutation(UPDATE_CHARACTER_STATUS, { refetchQueries: ['Characters', 'Dashboard'] })
  const [endEncounter, { loading: ending }] = useMutation(END_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
    onCompleted: () => navigate('/encounters'),
  })

  const { data: charsData } = useQuery(CAMPAIGN_CHARS, { variables: { campaignId }, skip: !campaignId })
  const campaignChars: CampaignChar[] = charsData?.characters ?? []

  // Add participant form
  const [addOpen, setAddOpen] = useState(false)
  const [selectedChar, setSelectedChar] = useState<CampaignChar | null>(null)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('monster')
  const [newInit, setNewInit] = useState('')
  const [newHpMax, setNewHpMax] = useState('')
  const [newHpCurrent, setNewHpCurrent] = useState('')
  const [newAc, setNewAc] = useState('')
  const [newCount, setNewCount] = useState('1')

  // End encounter dialog
  const [endOpen, setEndOpen] = useState(false)
  const [outcomeType, setOutcomeType] = useState('WIN')
  const [outcomeText, setOutcomeText] = useState('')

  // HP delta per participant
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({})

  // Kill tracking dialog
  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [killedParticipant, setKilledParticipant] = useState<Participant | null>(null)
  const [killedByName, setKilledByName] = useState('')
  const [killedDescription, setKilledDescription] = useState('')

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const encounter = data?.encounter
  if (!encounter) return null

  const activeParticipants: Participant[] = (encounter.participants as Participant[])
    .filter((p) => p.isActive)
    .sort((a, b) => b.initiative - a.initiative)

  const inactiveParticipants: Participant[] = (encounter.participants as Participant[])
    .filter((p) => !p.isActive)

  const currentParticipant = activeParticipants[encounter.currentTurnIndex] ?? null
  const isCompleted = encounter.status === 'COMPLETED'

  const applyHpDelta = async (p: Participant, delta: number) => {
    const current = p.hpCurrent ?? p.hpMax ?? 0
    const max = p.hpMax ?? 999
    const next = Math.max(0, Math.min(max, current + delta))
    await updateParticipant({ variables: { id: p.id, input: { hpCurrent: next } } })
  }

  const toggleCondition = async (p: Participant, cond: string) => {
    const current = p.conditions ?? []
    const next = current.includes(cond) ? current.filter((c) => c !== cond) : [...current, cond]
    await updateParticipant({ variables: { id: p.id, input: { conditions: next } } })
  }

  const handleToggleActive = (p: Participant) => {
    if (p.isActive && !p.isPlayer) {
      // Going inactive (dying) — prompt for kill tracking
      setKilledParticipant(p)
      setKilledByName('')
      setKilledDescription('')
      setKillDialogOpen(true)
    } else {
      updateParticipant({ variables: { id: p.id, input: { isActive: !p.isActive } } })
    }
  }

  const confirmKill = async () => {
    if (!killedParticipant) return
    await updateParticipant({
      variables: {
        id: killedParticipant.id,
        input: {
          isActive: false,
          killedByName: killedByName || undefined,
          killedDescription: killedDescription || undefined,
        },
      },
    })
    // If this participant is linked to a real character (non-monster), mark them dead
    if (killedParticipant.character?.id && !killedParticipant.isPlayer) {
      await updateCharacterStatus({ variables: { id: killedParticipant.character.id, status: 'DEAD' } })
    }
    setKillDialogOpen(false)
    setKilledParticipant(null)
  }

  const resetAddForm = () => {
    setSelectedChar(null); setNewName(''); setNewRole('monster')
    setNewInit(''); setNewHpMax(''); setNewHpCurrent(''); setNewAc(''); setNewCount('1')
  }

  const handleAddParticipant = async () => {
    const isMonster = newRole === 'monster'
    const count = isMonster ? Math.max(1, parseInt(newCount) || 1) : 1
    const isPlayer = newRole === 'player'
    const hpMax = newHpMax ? parseInt(newHpMax) : undefined
    const hpCurrent = newHpCurrent ? parseInt(newHpCurrent) : hpMax
    const ac = newAc ? parseInt(newAc) : undefined
    const init = newInit ? parseInt(newInit) : 0

    for (let i = 0; i < count; i++) {
      const name = count > 1 ? `${newName} ${i + 1}` : newName
      await addParticipant({
        variables: {
          encounterId: id,
          input: {
            name,
            isPlayer,
            characterId: selectedChar?.id,
            initiative: init,
            hpMax,
            hpCurrent,
            armorClass: ac,
          },
        },
      })
    }
    setAddOpen(false)
    resetAddForm()
  }

  const ParticipantRow = ({ p, isCurrent, readonly }: { p: Participant; isCurrent: boolean; readonly?: boolean }) => {
    const hpPct = p.hpMax ? Math.max(0, ((p.hpCurrent ?? 0) / p.hpMax) * 100) : null
    const hpColor = hpPct != null ? (hpPct > 50 ? '#62a870' : hpPct > 25 ? '#c8a44a' : '#b84848') : '#786c5c'

    return (
      <Box sx={{
        p: 1.5, borderRadius: 1, mb: 1,
        border: `1px solid ${isCurrent ? 'rgba(200,164,74,0.6)' : 'rgba(120,108,92,0.2)'}`,
        bgcolor: isCurrent ? '#1a160a' : '#111009',
        boxShadow: isCurrent ? '0 0 12px rgba(200,164,74,0.15)' : undefined,
        opacity: p.isActive ? 1 : 0.5,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 1, bgcolor: isCurrent ? '#3a2e14' : '#1a1610',
              border: `1px solid ${isCurrent ? '#c8a44a' : 'rgba(120,108,92,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', color: isCurrent ? '#c8a44a' : '#786c5c', fontWeight: 700 }}>
                {p.initiative}
              </Typography>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {isCurrent && <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#c8a44a' }} />}
                <Typography sx={{ fontSize: '0.88rem', color: isCurrent ? '#e6d8c0' : '#b4a48a', fontWeight: isCurrent ? 600 : 400 }}>
                  {p.name}
                </Typography>
                {p.isPlayer && <Chip label="PC" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#1a2a1a', color: '#62a870' }} />}
                {p.armorClass && (
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                    AC {p.armorClass}
                  </Typography>
                )}
              </Box>
              {/* Kill info for inactive NPCs */}
              {!p.isActive && p.killedByName && (
                <Typography sx={{ fontSize: '0.68rem', color: '#b84848', mt: 0.25 }}>
                  Slain by <strong>{p.killedByName}</strong>
                  {p.killedDescription && ` — ${p.killedDescription}`}
                </Typography>
              )}
            </Box>
          </Box>

          {/* HP controls / static display */}
          {p.hpMax != null && (
            readonly ? (
              <Box sx={{ textAlign: 'right', minWidth: 52 }}>
                <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', color: hpColor }}>
                  {p.hpCurrent ?? '—'}/{p.hpMax}
                </Typography>
                <FavoriteIcon sx={{ fontSize: 8, color: hpColor }} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton size="small"
                  onClick={() => applyHpDelta(p, -(parseInt(hpDelta[p.id] || '1') || 1))}
                  sx={{ color: '#b84848', width: 24, height: 24 }}>
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <TextField
                  value={hpDelta[p.id] ?? ''}
                  onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="Δ"
                  size="small"
                  inputProps={{ style: { textAlign: 'center', width: 32, fontFamily: '"JetBrains Mono"', fontSize: '0.78rem', padding: '2px 4px' } }}
                  sx={{ '& .MuiOutlinedInput-root': { height: 24 } }}
                />
                <IconButton size="small"
                  onClick={() => applyHpDelta(p, parseInt(hpDelta[p.id] || '1') || 1)}
                  sx={{ color: '#62a870', width: 24, height: 24 }}>
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <Box sx={{ textAlign: 'right', minWidth: 52 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', color: hpColor }}>
                    {p.hpCurrent ?? '—'}/{p.hpMax}
                  </Typography>
                  <FavoriteIcon sx={{ fontSize: 8, color: hpColor }} />
                </Box>
              </Box>
            )
          )}
        </Box>

        {/* HP bar */}
        {hpPct != null && (
          <LinearProgress variant="determinate" value={hpPct}
            sx={{ height: 3, borderRadius: 1, mb: 0.75, bgcolor: 'rgba(120,108,92,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: hpColor, borderRadius: 1 } }} />
        )}

        {/* Conditions */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {p.conditions.map((c) => (
            <Chip key={c} label={c} size="small"
              onDelete={readonly ? undefined : () => toggleCondition(p, c)}
              sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#3a1010', color: '#b84848', '& .MuiChip-deleteIcon': { fontSize: 10, color: '#b84848' } }} />
          ))}
          {!readonly && (
            <Tooltip title="Add condition">
              <Select
                value="" displayEmpty size="small"
                onChange={(e) => e.target.value && toggleCondition(p, e.target.value as string)}
                renderValue={() => '+'}
                sx={{ height: 18, fontSize: '0.62rem', '& .MuiSelect-select': { py: 0, px: 0.5 }, minWidth: 24 }}
              >
                {CONDITIONS.filter((c) => !p.conditions.includes(c)).map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
                ))}
              </Select>
            </Tooltip>
          )}

          {!readonly && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
              <Tooltip title={p.isActive ? 'Mark as defeated' : 'Restore'}>
                <Chip
                  label={p.isActive ? '✓ Active' : '✗ Out'}
                  size="small"
                  onClick={() => handleToggleActive(p)}
                  sx={{ height: 18, fontSize: '0.6rem', cursor: 'pointer',
                    bgcolor: p.isActive ? '#1a2a1a' : '#3a1010',
                    color: p.isActive ? '#62a870' : '#b84848' }}
                />
              </Tooltip>
              <Chip label="✕" size="small"
                onClick={() => removeParticipant({ variables: { id: p.id } })}
                sx={{ height: 18, fontSize: '0.6rem', cursor: 'pointer', bgcolor: '#1a1010', color: '#786c5c', '&:hover': { color: '#b84848' } }} />
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <IconButton size="small" onClick={() => navigate('/encounters')} sx={{ color: '#786c5c' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <LocalFireDepartmentIcon sx={{ fontSize: 18, color: '#b84848' }} />
            <Typography variant="h4" sx={{ color: '#e6d8c0' }}>{encounter.name}</Typography>
            {!isCompleted && (
              <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: '#1a0909', border: '1px solid rgba(180,72,72,0.4)' }}>
                <Typography sx={{ fontSize: '0.82rem', fontFamily: '"JetBrains Mono"', color: '#b84848' }}>
                  Round {encounter.round}
                </Typography>
              </Box>
            )}
            {isCompleted && encounter.outcomeType && (
              <Chip label={encounter.outcomeType} size="small"
                sx={{ bgcolor: '#1a2a1a', color: '#62a870', fontFamily: '"JetBrains Mono"' }} />
            )}
          </Box>
          {currentParticipant && !isCompleted && (
            <Typography sx={{ fontSize: '0.82rem', color: '#c8a44a', ml: 5 }}>
              Current turn: <strong>{currentParticipant.name}</strong>
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isCompleted && (
            <>
              <Tooltip title="Previous turn">
                <IconButton size="small" onClick={() => prevTurn({ variables: { id } })}
                  sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c' }}>
                  <SkipPreviousIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button variant="contained" startIcon={<SkipNextIcon />}
                onClick={() => nextTurn({ variables: { id } })}
                sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}>
                Next Turn
              </Button>
              <Button variant="outlined" startIcon={<PersonAddIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ borderColor: 'rgba(120,108,92,0.4)', color: '#786c5c' }}>
                Add
              </Button>
              <Button variant="outlined" startIcon={<EmojiEventsIcon />}
                onClick={() => setEndOpen(true)}
                sx={{ borderColor: 'rgba(200,164,74,0.3)', color: '#c8a44a' }}>
                End
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        {encounter.linkedDecision && (
          <Box sx={{ p: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(200,164,74,0.2)' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#786c5c' }}>
              Triggered by: <span style={{ color: '#c8a44a' }}>{encounter.linkedDecision.question}</span>
            </Typography>
          </Box>
        )}
        {encounter.outcomeDecision && (
          <Box sx={{ p: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(98,168,112,0.2)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <GpsFixedIcon sx={{ fontSize: 12, color: '#62a870' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#786c5c' }}>
              Leads to: <span style={{ color: '#62a870' }}>{encounter.outcomeDecision.question}</span>
            </Typography>
          </Box>
        )}
      </Box>

      {isCompleted && (
        <Box sx={{ mb: 2.5, p: 2, bgcolor: '#0d160d', borderRadius: 1, border: '1px solid rgba(98,168,112,0.25)' }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: encounter.outcome ? 1.5 : 0 }}>
            {encounter.outcomeType && (() => {
              const outcomeColor: Record<string, string> = { WIN: '#62a870', LOSS: '#b84848', FLEE: '#c8a44a', DRAW: '#786c5c' }
              const col = outcomeColor[encounter.outcomeType] ?? '#786c5c'
              return (
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Outcome</Typography>
                  <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: col, fontWeight: 700 }}>{encounter.outcomeType}</Typography>
                </Box>
              )
            })()}
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rounds</Typography>
              <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#c8a44a', fontWeight: 700 }}>{encounter.round}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Combatants</Typography>
              <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#b4a48a', fontWeight: 700 }}>{encounter.participants.length}</Typography>
            </Box>
            {encounter.startedAt && encounter.endedAt && (() => {
              const ms = new Date(encounter.endedAt).getTime() - new Date(encounter.startedAt).getTime()
              const mins = Math.floor(ms / 60000)
              const secs = Math.floor((ms % 60000) / 1000)
              return (
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Typography>
                  <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#b4a48a', fontWeight: 700 }}>
                    {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                  </Typography>
                </Box>
              )
            })()}
          </Box>
          {encounter.outcome && (
            <Typography sx={{ fontSize: '0.82rem', color: '#b4a48a', fontStyle: 'italic' }}>{encounter.outcome}</Typography>
          )}
        </Box>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {activeParticipants.map((p, i) => (
            <ParticipantRow key={p.id} p={p} isCurrent={i === encounter.currentTurnIndex && !isCompleted} readonly={isCompleted} />
          ))}

          {inactiveParticipants.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }}><Typography sx={{ fontSize: '0.7rem', color: '#786c5c' }}>OUT OF COMBAT</Typography></Divider>
              {inactiveParticipants.map((p) => <ParticipantRow key={p.id} p={p} isCurrent={false} readonly={isCompleted} />)}
            </>
          )}

          {encounter.participants.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#786c5c' }}>No participants yet.</Typography>
              <Button size="small" startIcon={<PersonAddIcon />} onClick={() => setAddOpen(true)} sx={{ mt: 1, color: '#c8a44a' }}>
                Add First Combatant
              </Button>
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
              Initiative Order
            </Typography>
            {activeParticipants.map((p, i) => (
              <Box key={p.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.4,
                borderLeft: i === encounter.currentTurnIndex && !isCompleted ? '2px solid #c8a44a' : '2px solid transparent',
                pl: 1,
              }}>
                <Typography sx={{ fontSize: '0.72rem', fontFamily: '"JetBrains Mono"', color: '#786c5c', minWidth: 20 }}>
                  {p.initiative}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: i === encounter.currentTurnIndex && !isCompleted ? '#c8a44a' : '#b4a48a' }}>
                  {p.name}
                </Typography>
                {p.hpMax != null && (
                  <Typography sx={{ ml: 'auto', fontSize: '0.68rem', fontFamily: '"JetBrains Mono"', color: '#786c5c' }}>
                    {p.hpCurrent}/{p.hpMax}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* Add Participant Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); resetAddForm() }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>Add Combatant</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>

            {/* Existing character picker */}
            <Grid item xs={12}>
              <Autocomplete
                options={campaignChars}
                getOptionLabel={(c) => `${c.name} (${c.role})`}
                value={selectedChar}
                onChange={(_, c) => {
                  setSelectedChar(c)
                  if (c) {
                    setNewName(c.name)
                    setNewRole(c.role.toLowerCase())
                    setNewHpMax(c.hpMax != null ? String(c.hpMax) : '')
                    setNewHpCurrent(c.hpCurrent != null ? String(c.hpCurrent) : '')
                    setNewAc(c.armorClass != null ? String(c.armorClass) : '')
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Pick existing character (optional)" size="small" />}
                clearOnEscape
              />
            </Grid>

            {/* Role */}
            <Grid item xs={12}>
              <FormControl size="small" fullWidth>
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <MenuItem value="monster">Monster</MenuItem>
                  <MenuItem value="player">Player Character</MenuItem>
                  <MenuItem value="npc">NPC</MenuItem>
                  <MenuItem value="ally">Ally</MenuItem>
                  <MenuItem value="villain">Villain</MenuItem>
                  <MenuItem value="neutral">Neutral</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Name + Count (count only for monsters) */}
            <Grid item xs={newRole === 'monster' ? 8 : 12}>
              <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth size="small" />
            </Grid>
            {newRole === 'monster' && (
              <Grid item xs={4}>
                <TextField label="Count" type="number" value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  fullWidth size="small"
                  inputProps={{ min: 1, max: 20 }} />
              </Grid>
            )}

            <Grid item xs={6}>
              <TextField label="Initiative" type="number" value={newInit} onChange={(e) => setNewInit(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="AC" type="number" value={newAc} onChange={(e) => setNewAc(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="HP Max" type="number" value={newHpMax} onChange={(e) => setNewHpMax(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="HP Current" type="number" value={newHpCurrent} onChange={(e) => setNewHpCurrent(e.target.value)} fullWidth size="small" placeholder="= HP Max" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => { setAddOpen(false); resetAddForm() }} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={handleAddParticipant} disabled={!newName || addingP} variant="contained" size="small">
            {newRole === 'monster' && parseInt(newCount) > 1 ? `Add ${newCount}` : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kill Tracking Dialog */}
      <Dialog open={killDialogOpen} onClose={() => setKillDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(184,72,72,0.3)' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', pb: 0.5 }}>
          {killedParticipant?.name} falls
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: '#786c5c', mb: 2, fontStyle: 'italic' }}>
            Record who delivered the killing blow and how it happened.
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField
                label="Slain by"
                value={killedByName}
                onChange={(e) => setKilledByName(e.target.value)}
                fullWidth size="small"
                placeholder="e.g. Thorin Stormhammer"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="How it happened"
                value={killedDescription}
                onChange={(e) => setKilledDescription(e.target.value)}
                fullWidth size="small" multiline rows={3}
                placeholder="e.g. A critical strike through the visor as it charged..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setKillDialogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button
            onClick={confirmKill}
            variant="contained" size="small"
            sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Encounter Dialog */}
      <Dialog open={endOpen} onClose={() => setEndOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>End Encounter</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl size="small" fullWidth>
                <Select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value)}>
                  <MenuItem value="WIN">Victory</MenuItem>
                  <MenuItem value="LOSS">Defeat</MenuItem>
                  <MenuItem value="FLEE">Fled / Retreated</MenuItem>
                  <MenuItem value="DRAW">Draw / Standoff</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Outcome notes" value={outcomeText} onChange={(e) => setOutcomeText(e.target.value)}
                fullWidth size="small" multiline rows={2} placeholder="What happened?" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEndOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={() => endEncounter({ variables: { id, outcomeType, outcome: outcomeText || undefined } })}
            disabled={ending} variant="contained" size="small"
            sx={{ bgcolor: '#c8a44a', '&:hover': { bgcolor: '#e6c86a' } }}>
            End Encounter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
