import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel, Grid,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const CREATE_ITEM = gql`
  mutation CreateItem($input: CreateItemInput!) {
    createItem(input: $input) { id name }
  }
`

const UPDATE_ITEM = gql`
  mutation UpdateItem($id: ID!, $input: UpdateItemInput!) {
    updateItem(id: $id, input: $input) { id name }
  }
`

const ITEM_TYPES = ['ITEM', 'KEY_ITEM', 'RELIC', 'EQUIPMENT', 'CONSUMABLE', 'QUEST', 'PROP']

interface ItemData {
  id?: string
  name?: string
  type?: string
  description?: string | null
  narrativeWeight?: string | null
  locationFound?: string | null
  requiredFor?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  item?: ItemData | null
}

export default function ItemFormDialog({ open, onClose, onSaved, item }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!item?.id

  const [name, setName] = useState('')
  const [type, setType] = useState('ITEM')
  const [description, setDescription] = useState('')
  const [narrativeWeight, setNarrativeWeight] = useState('')
  const [locationFound, setLocationFound] = useState('')
  const [requiredFor, setRequiredFor] = useState('')

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setType(item?.type ?? 'ITEM')
      setDescription(item?.description ?? '')
      setNarrativeWeight(item?.narrativeWeight ?? '')
      setLocationFound(item?.locationFound ?? '')
      setRequiredFor(item?.requiredFor ?? '')
    }
  }, [open, item])

  const [createItem, { loading: creating }] = useMutation(CREATE_ITEM)
  const [updateItem, { loading: updating }] = useMutation(UPDATE_ITEM)
  const loading = creating || updating

  const handleSave = async () => {
    const input = {
      name,
      type,
      description: description || undefined,
      narrativeWeight: narrativeWeight || undefined,
      locationFound: locationFound || undefined,
      requiredFor: requiredFor || undefined,
    }

    if (isEdit) {
      await updateItem({ variables: { id: item!.id, input } })
    } else {
      await createItem({ variables: { input: { ...input, campaignId } } })
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Item' : 'New Item'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={8}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={type} onChange={(e) => setType(e.target.value)} label="Type">
                {ITEM_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Narrative Weight"
              value={narrativeWeight}
              onChange={(e) => setNarrativeWeight(e.target.value)}
              fullWidth size="small"
              placeholder="critical, high, medium, low"
              helperText={'Use "critical" or "high" to mark as story-critical'}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Location Found" value={locationFound} onChange={(e) => setLocationFound(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Required For" value={requiredFor} onChange={(e) => setRequiredFor(e.target.value)} fullWidth size="small" />
          </Grid>
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
