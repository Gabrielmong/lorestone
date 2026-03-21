import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, List, ListItem, ListItemText, IconButton,
  Tooltip, Button, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useCampaign } from '../context/campaign'
import SessionFormDialog from '../components/SessionFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import StatusBadge from '../components/StatusBadge'

const SESSIONS = gql`
  query Sessions($campaignId: ID!) {
    campaign(id: $campaignId) {
      id
      sessions {
        id sessionNumber title status playedAt dmNotes playerSummary
        chapter { id name }
      }
      currentSession { id }
    }
  }
`

const DELETE_SESSION = gql`
  mutation DeleteSessionFromPage($id: ID!) { deleteSession(id: $id) }
`

const START_SESSION = gql`
  mutation StartSessionFromPage($id: ID!) {
    startSession(id: $id) { id status }
  }
`

type Session = {
  id: string
  sessionNumber: number
  title?: string | null
  status: string
  playedAt?: string | null
  dmNotes?: string | null
  playerSummary?: string | null
  chapter?: { id: string; name: string } | null
}

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 }

export default function Sessions() {
  const { campaignId } = useCampaign()
  const navigate = useNavigate()

  const [sessionFormOpen, setSessionFormOpen] = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [deleteSessionNum, setDeleteSessionNum] = useState(0)

  const { data, refetch } = useQuery(SESSIONS, {
    variables: { campaignId },
    skip: !campaignId,
    fetchPolicy: 'cache-and-network',
  })

  const [deleteSession, { loading: deletingSession }] = useMutation(DELETE_SESSION, {
    refetchQueries: ['Sessions', 'Dashboard'],
  })
  const [startSession] = useMutation(START_SESSION, { refetchQueries: ['Sessions'] })

  const campaign = data?.campaign
  const sessions: Session[] = (campaign?.sessions ?? [])
    .slice()
    .sort((a: Session, b: Session) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      if (statusDiff !== 0) return statusDiff
      return b.sessionNumber - a.sessionNumber
    })

  const activeSessionId = campaign?.currentSession?.id
  const nextSessionNumber = sessions.length > 0
    ? Math.max(...sessions.map((s) => s.sessionNumber)) + 1
    : 1

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a' }}>
          Sessions
        </Typography>
        <Button size="small" startIcon={<AddIcon />} variant="outlined"
          onClick={() => { setEditSession(null); setSessionFormOpen(true) }}
          sx={{ color: '#c8a44a', borderColor: 'rgba(200,164,74,0.3)', fontSize: '0.78rem' }}>
          New Session
        </Button>
      </Box>

      {sessions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: '2rem', mb: 1 }}>📜</Typography>
          <Typography sx={{ color: '#786c5c', fontFamily: '"Cinzel", serif' }}>No sessions yet.</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId
            return (
              <ListItem key={s.id}
                onClick={() => navigate(`/session/${s.id}`)}
                sx={{
                  bgcolor: isActive ? 'rgba(200,164,74,0.08)' : '#111009',
                  borderRadius: 1, mb: 0.75, pr: 1, cursor: 'pointer',
                  border: isActive ? '1px solid rgba(200,164,74,0.35)' : '1px solid rgba(120,108,92,0.2)',
                  '&:hover': { borderColor: 'rgba(200,164,74,0.3)', bgcolor: isActive ? 'rgba(200,164,74,0.12)' : '#151209' },
                }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.78rem', color: '#c8a44a', minWidth: 28 }}>
                        #{s.sessionNumber}
                      </Typography>
                      <StatusBadge status={s.status} />
                      <Typography sx={{ fontSize: '0.88rem', color: '#e6d8c0', fontFamily: '"Cinzel", serif' }}>
                        {s.title ?? `Session ${s.sessionNumber}`}
                      </Typography>
                      {s.chapter && (
                        <Chip label={s.chapter.name} size="small"
                          sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(120,108,92,0.15)', color: '#786c5c', fontFamily: '"JetBrains Mono"' }} />
                      )}
                    </Box>
                  }
                  secondary={
                    s.playedAt ? (
                      <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', mt: 0.25 }}>
                        {new Date(s.playedAt).toLocaleDateString()}
                      </Typography>
                    ) : null
                  }
                />
                <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                  {s.status === 'PLANNED' && !activeSessionId && (
                    <Tooltip title="Start session">
                      <IconButton size="small"
                        onClick={() => startSession({ variables: { id: s.id } }).then(() => navigate(`/session/${s.id}`))}
                        sx={{ color: '#62a870', '&:hover': { color: '#82c890' }, width: 28, height: 28 }}>
                        <PlayArrowIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditSession(s); setSessionFormOpen(true) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 28, height: 28 }}>
                      <EditIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => { setDeleteSessionId(s.id); setDeleteSessionNum(s.sessionNumber) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 28, height: 28 }}>
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>
            )
          })}
        </List>
      )}

      {sessionFormOpen && (
        <SessionFormDialog
          open={sessionFormOpen}
          nextSessionNumber={nextSessionNumber}
          session={editSession ?? undefined}
          onClose={() => setSessionFormOpen(false)}
          onSaved={() => { setSessionFormOpen(false); refetch() }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleteSessionId}
        title={`Delete Session #${deleteSessionNum}?`}
        message="This will permanently delete the session and all its events."
        loading={deletingSession}
        onClose={() => setDeleteSessionId(null)}
        onConfirm={async () => {
          if (deleteSessionId) {
            await deleteSession({ variables: { id: deleteSessionId } })
            setDeleteSessionId(null)
          }
        }}
      />
    </Box>
  )
}
