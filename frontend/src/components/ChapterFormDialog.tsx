import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel, Grid,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const CREATE_CHAPTER = gql`
  mutation CreateChapter($input: CreateChapterInput!) {
    createChapter(input: $input) { id name }
  }
`

const UPDATE_CHAPTER = gql`
  mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!) {
    updateChapter(id: $id, input: $input) { id name }
  }
`

const CHAPTER_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED']

interface ChapterData {
  id?: string
  name?: string
  summary?: string | null
  status?: string
  orderIndex?: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  chapter?: ChapterData | null
  nextOrderIndex?: number
}

export default function ChapterFormDialog({ open, onClose, onSaved, chapter, nextOrderIndex = 0 }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!chapter?.id

  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [orderIndex, setOrderIndex] = useState('')

  useEffect(() => {
    if (open) {
      setName(chapter?.name ?? '')
      setSummary(chapter?.summary ?? '')
      setStatus(chapter?.status ?? 'PENDING')
      setOrderIndex(chapter?.orderIndex != null ? String(chapter.orderIndex) : String(nextOrderIndex))
    }
  }, [open, chapter, nextOrderIndex])

  const [createChapter, { loading: creating }] = useMutation(CREATE_CHAPTER)
  const [updateChapter, { loading: updating }] = useMutation(UPDATE_CHAPTER)
  const loading = creating || updating

  const handleSave = async () => {
    if (isEdit) {
      await updateChapter({
        variables: {
          id: chapter!.id,
          input: {
            name,
            summary: summary || undefined,
            status,
            orderIndex: parseInt(orderIndex) || 0,
          },
        },
      })
    } else {
      await createChapter({
        variables: {
          input: {
            campaignId,
            name,
            summary: summary || undefined,
            orderIndex: parseInt(orderIndex) || 0,
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
        {isEdit ? 'Edit Chapter' : 'New Chapter'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={8}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField label="Order" type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                {CHAPTER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} fullWidth size="small" multiline rows={3} />
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
