import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid,
} from '@mui/material'

const CREATE_CAMPAIGN = gql`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) { id name shareToken }
  }
`

const UPDATE_CAMPAIGN = gql`
  mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
    updateCampaign(id: $id, input: $input) { id name }
  }
`

interface CampaignData {
  id?: string
  name?: string
  system?: string | null
  description?: string | null
  yearInGame?: string | null
  playerCount?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (id?: string) => void
  campaign?: CampaignData | null
}

export default function CampaignFormDialog({ open, onClose, onSaved, campaign }: Props) {
  const isEdit = !!campaign?.id

  const [name, setName] = useState('')
  const [system, setSystem] = useState('')
  const [description, setDescription] = useState('')
  const [yearInGame, setYearInGame] = useState('')
  const [playerCount, setPlayerCount] = useState('')

  useEffect(() => {
    if (open) {
      setName(campaign?.name ?? '')
      setSystem(campaign?.system ?? '')
      setDescription(campaign?.description ?? '')
      setYearInGame(campaign?.yearInGame ?? '')
      setPlayerCount(campaign?.playerCount != null ? String(campaign.playerCount) : '')
    }
  }, [open, campaign])

  const [createCampaign, { loading: creating }] = useMutation(CREATE_CAMPAIGN)
  const [updateCampaign, { loading: updating }] = useMutation(UPDATE_CAMPAIGN)
  const loading = creating || updating

  const handleSave = async () => {
    const input = {
      name,
      system: system || undefined,
      description: description || undefined,
      yearInGame: yearInGame || undefined,
      playerCount: playerCount ? parseInt(playerCount) : undefined,
    }

    if (isEdit) {
      await updateCampaign({ variables: { id: campaign!.id, input } })
      onSaved()
    } else {
      const result = await createCampaign({ variables: { input } })
      onSaved(result.data?.createCampaign?.id)
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Campaign' : 'New Campaign'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField label="Campaign Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="System" value={system} onChange={(e) => setSystem(e.target.value)} fullWidth size="small" placeholder="e.g. D&D 5e, TTRPG" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Year In-Game" value={yearInGame} onChange={(e) => setYearInGame(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Players" type="number" value={playerCount} onChange={(e) => setPlayerCount(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={3} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !name} variant="contained" size="small">
          {loading ? 'Saving…' : isEdit ? 'Save' : 'Create Campaign'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
