import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const CREATE_FACTION = gql`
  mutation CreateFaction($input: CreateFactionInput!) {
    createFaction(input: $input) { id name }
  }
`

const UPDATE_FACTION = gql`
  mutation UpdateFaction($id: ID!, $input: UpdateFactionInput!) {
    updateFaction(id: $id, input: $input) { id name }
  }
`

interface FactionData {
  id?: string
  name?: string
  description?: string | null
  color?: string | null
  icon?: string | null
  repMin?: number
  repMax?: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  faction?: FactionData | null
}

export default function FactionFormDialog({ open, onClose, onSaved, faction }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!faction?.id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('')
  const [icon, setIcon] = useState('')
  const [repMin, setRepMin] = useState('-3')
  const [repMax, setRepMax] = useState('3')

  useEffect(() => {
    if (open) {
      setName(faction?.name ?? '')
      setDescription(faction?.description ?? '')
      setColor(faction?.color ?? '')
      setIcon(faction?.icon ?? '')
      setRepMin(faction?.repMin != null ? String(faction.repMin) : '-3')
      setRepMax(faction?.repMax != null ? String(faction.repMax) : '3')
    }
  }, [open, faction])

  const [createFaction, { loading: creating }] = useMutation(CREATE_FACTION)
  const [updateFaction, { loading: updating }] = useMutation(UPDATE_FACTION)
  const loading = creating || updating

  const handleSave = async () => {
    const input = {
      name,
      description: description || undefined,
      color: color || undefined,
      icon: icon || undefined,
    }

    if (isEdit) {
      await updateFaction({ variables: { id: faction!.id, input } })
    } else {
      await createFaction({
        variables: {
          input: {
            ...input,
            campaignId,
            repMin: parseInt(repMin) || -3,
            repMax: parseInt(repMax) || 3,
          },
        },
      })
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Faction' : 'New Faction'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={3} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Color (hex)" value={color} onChange={(e) => setColor(e.target.value)} fullWidth size="small" placeholder="#c8a44a" />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Icon (emoji or text)" value={icon} onChange={(e) => setIcon(e.target.value)} fullWidth size="small" />
          </Grid>
          {!isEdit && (
            <>
              <Grid item xs={6}>
                <TextField label="Rep Min" type="number" value={repMin} onChange={(e) => setRepMin(e.target.value)} fullWidth size="small" />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Rep Max" type="number" value={repMax} onChange={(e) => setRepMax(e.target.value)} fullWidth size="small" />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !name} variant="contained" size="small">
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
