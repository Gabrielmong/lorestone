import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const CREATE_SESSION = gql`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) { id sessionNumber }
  }
`

const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) { id title }
  }
`

interface SessionData {
  id?: string
  sessionNumber?: number
  title?: string | null
  dmNotes?: string | null
  playerSummary?: string | null
  playedAt?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  onCreated?: (id: string) => void
  session?: SessionData | null
  nextSessionNumber?: number
}

export default function SessionFormDialog({ open, onClose, onSaved, onCreated, session, nextSessionNumber = 1 }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!session?.id

  const [sessionNumber, setSessionNumber] = useState('')
  const [title, setTitle] = useState('')
  const [dmNotes, setDmNotes] = useState('')
  const [playerSummary, setPlayerSummary] = useState('')
  const [playedAt, setPlayedAt] = useState('')

  useEffect(() => {
    if (open) {
      setSessionNumber(session?.sessionNumber != null ? String(session.sessionNumber) : String(nextSessionNumber))
      setTitle(session?.title ?? '')
      setDmNotes(session?.dmNotes ?? '')
      setPlayerSummary(session?.playerSummary ?? '')
      setPlayedAt(session?.playedAt ? session.playedAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
    }
  }, [open, session, nextSessionNumber])

  const [createSession, { loading: creating }] = useMutation(CREATE_SESSION)
  const [updateSession, { loading: updating }] = useMutation(UPDATE_SESSION)
  const loading = creating || updating

  const handleSave = async () => {
    if (isEdit) {
      await updateSession({
        variables: {
          id: session!.id,
          input: {
            title: title || undefined,
            dmNotes: dmNotes || undefined,
            playerSummary: playerSummary || undefined,
            playedAt: playedAt || undefined,
          },
        },
      })
    } else {
      const result = await createSession({
        variables: {
          input: {
            campaignId,
            sessionNumber: parseInt(sessionNumber),
            title: title || undefined,
            playedAt: playedAt || undefined,
          },
        },
      })
      const created = result.data?.createSession
      if (created?.id && onCreated) {
        onCreated(created.id)
        onClose()
        return
      }
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Session' : 'New Session'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {!isEdit && (
            <Grid item xs={4}>
              <TextField label="Session #" type="number" value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)} fullWidth size="small" required />
            </Grid>
          )}
          <Grid item xs={isEdit ? 12 : 8}>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Played At"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              fullWidth size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField label="DM Notes" value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} fullWidth size="small" multiline rows={3} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Player Summary" value={playerSummary} onChange={(e) => setPlayerSummary(e.target.value)} fullWidth size="small" multiline rows={3} helperText="Visible to players via share link" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading} variant="contained" size="small">
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
