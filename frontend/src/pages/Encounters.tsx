import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Button, Chip, CircularProgress, Alert,
  IconButton, Tooltip, Card, CardContent,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import { useCampaign } from '../context/campaign'
import EncounterFormDialog from '../components/EncounterFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const ENCOUNTERS = gql`
  query Encounters($campaignId: ID!) {
    encounters(campaignId: $campaignId) {
      id name description status round outcomeType outcome
      linkedDecision { id question }
      outcomeDecision { id question }
      participants { id name isPlayer isActive hpCurrent hpMax }
      startedAt endedAt createdAt
    }
  }
`

const DELETE_ENCOUNTER = gql`
  mutation DeleteEncounter($id: ID!) { deleteEncounter(id: $id) }
`

const START_ENCOUNTER = gql`
  mutation StartEncounter($id: ID!) {
    startEncounter(id: $id) { id status }
  }
`

const OUTCOME_COLOR: Record<string, string> = {
  WIN: '#62a870', LOSS: '#b84848', FLEE: '#c8a44a', DRAW: '#786c5c',
}

type Encounter = {
  id: string; name: string; description?: string | null; status: string
  round: number; outcomeType?: string | null; outcome?: string | null
  linkedDecision?: { id: string; question: string } | null
  outcomeDecision?: { id: string; question: string } | null
  linkedDecisionId?: string | null; outcomeDecisionId?: string | null
  participants: Array<{ id: string; name: string; isPlayer: boolean; isActive: boolean; hpCurrent?: number | null; hpMax?: number | null }>
  startedAt?: string | null; endedAt?: string | null; createdAt: string
}

export default function Encounters() {
  const navigate = useNavigate()
  const { campaignId } = useCampaign()
  const [formOpen, setFormOpen] = useState(false)
  const [editEncounter, setEditEncounter] = useState<Encounter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { data, loading, error, refetch } = useQuery(ENCOUNTERS, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const [deleteEncounter, { loading: deleting }] = useMutation(DELETE_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
  })
  const [startEncounter] = useMutation(START_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
  })

  const encounters: Encounter[] = data?.encounters ?? []
  const active = encounters.filter((e) => e.status === 'ACTIVE' || e.status === 'PAUSED')
  const pending = encounters.filter((e) => e.status === 'PENDING')
  const completed = encounters.filter((e) => e.status === 'COMPLETED')

  const statusColor: Record<string, string> = {
    ACTIVE: '#b84848', PAUSED: '#c8a44a', PENDING: '#786c5c', COMPLETED: '#62a870',
  }

  const EncounterCard = ({ enc }: { enc: Encounter }) => (
    <Card sx={{
      border: `1px solid ${enc.status === 'ACTIVE' ? 'rgba(180,72,72,0.5)' : enc.status === 'PAUSED' ? 'rgba(200,164,74,0.4)' : 'rgba(120,108,92,0.2)'}`,
      bgcolor: enc.status === 'ACTIVE' ? '#160a0a' : enc.status === 'PAUSED' ? '#141100' : '#111009',
      position: 'relative',
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ fontSize: 14, color: statusColor[enc.status] ?? '#786c5c' }} />
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#e6d8c0' }}>
                {enc.name}
              </Typography>
              <Chip label={enc.status} size="small" sx={{
                height: 16, fontSize: '0.6rem', fontFamily: '"JetBrains Mono"',
                bgcolor: `${statusColor[enc.status] ?? '#786c5c'}20`,
                color: statusColor[enc.status] ?? '#786c5c',
              }} />
              {enc.outcomeType && (
                <Chip label={enc.outcomeType} size="small" sx={{
                  height: 16, fontSize: '0.6rem', fontFamily: '"JetBrains Mono"',
                  bgcolor: `${OUTCOME_COLOR[enc.outcomeType] ?? '#786c5c'}20`,
                  color: OUTCOME_COLOR[enc.outcomeType] ?? '#786c5c',
                }} />
              )}
            </Box>
            {enc.description && (
              <Typography sx={{ fontSize: '0.78rem', color: '#786c5c', mb: 0.5 }}>{enc.description}</Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                {enc.participants.length} combatants
                {(enc.status === 'ACTIVE' || enc.status === 'PAUSED') && ` · Round ${enc.round}`}
              </Typography>
              {enc.linkedDecision && (
                <Typography sx={{ fontSize: '0.7rem', color: '#c8a44a' }}>
                  → {enc.linkedDecision.question.slice(0, 50)}{enc.linkedDecision.question.length > 50 ? '…' : ''}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {enc.status === 'PENDING' && (
              <Tooltip title="Start encounter">
                <IconButton size="small"
                  onClick={() => startEncounter({ variables: { id: enc.id } }).then(() => navigate(`/encounter/${enc.id}`))}
                  sx={{ color: '#62a870', '&:hover': { color: '#8ede9a' }, width: 28, height: 28 }}>
                  <PlayArrowIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {(enc.status === 'ACTIVE' || enc.status === 'PAUSED') && (
              <Button size="small" variant="contained"
                onClick={() => navigate(`/encounter/${enc.id}`)}
                sx={{
                  bgcolor: enc.status === 'PAUSED' ? 'transparent' : '#b84848',
                  border: enc.status === 'PAUSED' ? '1px solid rgba(200,164,74,0.5)' : 'none',
                  color: enc.status === 'PAUSED' ? '#c8a44a' : '#fff',
                  '&:hover': { bgcolor: enc.status === 'PAUSED' ? 'rgba(200,164,74,0.1)' : '#d45f5f' },
                  fontSize: '0.72rem', py: 0.25,
                }}>
                {enc.status === 'PAUSED' ? '⏸ Continue' : 'Resume'}
              </Button>
            )}
            {enc.status === 'COMPLETED' && (
              <Button size="small" variant="outlined"
                onClick={() => navigate(`/encounter/${enc.id}`)}
                sx={{ borderColor: 'rgba(120,108,92,0.3)', color: '#786c5c', fontSize: '0.72rem', py: 0.25 }}>
                View
              </Button>
            )}
            <IconButton size="small" onClick={() => { setEditEncounter({ ...enc, linkedDecisionId: enc.linkedDecision?.id ?? null, outcomeDecisionId: enc.outcomeDecision?.id ?? null }); setFormOpen(true) }}
              sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 26, height: 26 }}>
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
            <IconButton size="small" onClick={() => { setDeleteId(enc.id); setDeleteName(enc.name) }}
              sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 26, height: 26 }}>
              <DeleteIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box
      pt={isMobile ? 1 : 0}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4">Encounters</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditEncounter(null); setFormOpen(true) }}
          sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}>
          New Encounter
        </Button>
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>}
      {error && <Alert severity="error">{error.message}</Alert>}

      {active.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#b84848', textTransform: 'uppercase', letterSpacing: 1, mb: 1, fontFamily: '"JetBrains Mono"' }}>
            ⚡ Active
          </Typography>
          <Grid container spacing={1.5}>
            {active.map((enc) => <Grid item xs={12} md={6} key={enc.id}><EncounterCard enc={enc} /></Grid>)}
          </Grid>
        </Box>
      )}

      {pending.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, mb: 1, fontFamily: '"JetBrains Mono"' }}>
            Pending
          </Typography>
          <Grid container spacing={1.5}>
            {pending.map((enc) => <Grid item xs={12} md={6} key={enc.id}><EncounterCard enc={enc} /></Grid>)}
          </Grid>
        </Box>
      )}

      {completed.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#62a870', textTransform: 'uppercase', letterSpacing: 1, mb: 1, fontFamily: '"JetBrains Mono"' }}>
            Completed
          </Typography>
          <Grid container spacing={1.5}>
            {completed.map((enc) => <Grid item xs={12} md={6} key={enc.id}><EncounterCard enc={enc} /></Grid>)}
          </Grid>
        </Box>
      )}

      {encounters.length === 0 && !loading && (
        <Typography sx={{ color: '#786c5c', textAlign: 'center', py: 6 }}>No encounters yet.</Typography>
      )}

      <EncounterFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEncounter(null) }}
        onSaved={(id) => { refetch(); if (id && !editEncounter) navigate(`/encounter/${id}`) }}
        encounter={editEncounter}
      />
      <ConfirmDeleteDialog
        open={!!deleteId}
        title={`Delete "${deleteName}"?`}
        message="This encounter and all participant data will be permanently deleted."
        onConfirm={async () => { if (deleteId) { await deleteEncounter({ variables: { id: deleteId } }); setDeleteId(null) } }}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
