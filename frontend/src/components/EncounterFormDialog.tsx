import { useState, useEffect } from 'react'
import { useMutation, useQuery, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, FormControl, InputLabel, Select, MenuItem,
  Typography,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const DECISIONS_FOR_LINK = gql`
  query DecisionsForLink($campaignId: ID!) {
    decisions(campaignId: $campaignId) { id question missionName }
  }
`

const CREATE_ENCOUNTER = gql`
  mutation CreateEncounter($input: CreateEncounterInput!) {
    createEncounter(input: $input) { id name }
  }
`

const UPDATE_ENCOUNTER = gql`
  mutation UpdateEncounterForm($id: ID!, $input: UpdateEncounterInput!) {
    updateEncounter(id: $id, input: $input) { id name }
  }
`

interface EncounterData {
  id?: string
  name?: string
  description?: string | null
  linkedDecisionId?: string | null
  outcomeDecisionId?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (id?: string) => void
  encounter?: EncounterData | null
}

export default function EncounterFormDialog({ open, onClose, onSaved, encounter }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!encounter?.id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [linkedDecisionId, setLinkedDecisionId] = useState('')
  const [outcomeDecisionId, setOutcomeDecisionId] = useState('')

  const { data: decisionsData } = useQuery(DECISIONS_FOR_LINK, {
    variables: { campaignId },
    skip: !open || !campaignId,
  })

  useEffect(() => {
    if (open) {
      setName(encounter?.name ?? '')
      setDescription(encounter?.description ?? '')
      setLinkedDecisionId(encounter?.linkedDecisionId ?? '')
      setOutcomeDecisionId(encounter?.outcomeDecisionId ?? '')
    }
  }, [open, encounter])

  const [createEncounter, { loading: creating }] = useMutation(CREATE_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
  })
  const [updateEncounter, { loading: updating }] = useMutation(UPDATE_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
  })
  const loading = creating || updating

  const handleSave = async () => {
    const input = {
      name,
      description: description || undefined,
      linkedDecisionId: linkedDecisionId || undefined,
      outcomeDecisionId: outcomeDecisionId || undefined,
    }
    let savedId: string | undefined
    if (isEdit) {
      await updateEncounter({ variables: { id: encounter!.id, input } })
      savedId = encounter!.id
    } else {
      const res = await createEncounter({ variables: { input: { ...input, campaignId } } })
      savedId = res.data?.createEncounter?.id
    }
    onSaved(savedId)
    onClose()
  }

  const decisions = decisionsData?.decisions ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Encounter' : 'New Encounter'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField label="Encounter Name" value={name} onChange={(e) => setName(e.target.value)}
              fullWidth size="small" required />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description / Setup Notes" value={description}
              onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <FormControl size="small" fullWidth>
              <InputLabel>Triggered by Decision (optional)</InputLabel>
              <Select value={linkedDecisionId} onChange={(e) => setLinkedDecisionId(e.target.value)}
                label="Triggered by Decision (optional)">
                <MenuItem value=""><em>None</em></MenuItem>
                {decisions.map((d: { id: string; question: string; missionName?: string | null }) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Typography sx={{ fontSize: '0.82rem' }}>
                      {d.question.length > 60 ? d.question.slice(0, 60) + '…' : d.question}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl size="small" fullWidth>
              <InputLabel>Leads to Decision (optional)</InputLabel>
              <Select value={outcomeDecisionId} onChange={(e) => setOutcomeDecisionId(e.target.value)}
                label="Leads to Decision (optional)">
                <MenuItem value=""><em>None</em></MenuItem>
                {decisions.map((d: { id: string; question: string; missionName?: string | null }) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Typography sx={{ fontSize: '0.82rem' }}>
                      {d.question.length > 60 ? d.question.slice(0, 60) + '…' : d.question}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
