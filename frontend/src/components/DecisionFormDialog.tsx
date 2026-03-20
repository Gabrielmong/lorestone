import { useState, useEffect } from 'react'
import { useMutation, useQuery, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Box, Typography, IconButton, Divider,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCampaign } from '../context/campaign'

const CHAPTERS = gql`
  query DecisionFormChapters($campaignId: ID!) {
    campaign(id: $campaignId) {
      id
      chapters { id name orderIndex }
    }
  }
`

const CREATE_DECISION = gql`
  mutation CreateDecision($input: CreateDecisionInput!) {
    createDecision(input: $input) { id question }
  }
`

const UPDATE_DECISION = gql`
  mutation UpdateDecision($id: ID!, $input: UpdateDecisionInput!) {
    updateDecision(id: $id, input: $input) { id question }
  }
`

const UPDATE_BRANCH = gql`
  mutation UpdateBranch($id: ID!, $input: UpdateBranchInput!) {
    updateBranch(id: $id, input: $input) { id label }
  }
`

const ADD_BRANCH = gql`
  mutation AddBranch($decisionId: ID!, $input: CreateBranchInput!) {
    addBranch(decisionId: $decisionId, input: $input) { id label }
  }
`

const DELETE_BRANCH = gql`
  mutation DeleteBranch($id: ID!) {
    deleteBranch(id: $id)
  }
`

const OUTCOME_TYPES = ['NEUTRAL', 'GOOD', 'BAD', 'VARIABLE']

interface ExistingBranch {
  id: string
  label: string
  description?: string | null
  consequence?: string | null
  outcomeType: string
  orderIndex: number
}

interface NewBranch {
  label: string
  description: string
  consequence: string
  outcomeType: string
}

interface DecisionData {
  id?: string
  question?: string
  context?: string | null
  missionName?: string | null
  status?: string
  chapter?: { id: string; name: string } | null
  branches?: ExistingBranch[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  decision?: DecisionData | null
}

const defaultNewBranch = (): NewBranch => ({ label: '', description: '', consequence: '', outcomeType: 'NEUTRAL' })

const OUTCOME_COLOR: Record<string, string> = {
  GOOD: '#62a870',
  BAD: '#b84848',
  NEUTRAL: '#786c5c',
  VARIABLE: '#c8a44a',
}

function BranchEditor({
  branch, index, onChange, onDelete,
}: {
  branch: { label: string; description?: string | null; consequence?: string | null; outcomeType: string }
  index: number
  onChange: (field: string, val: string) => void
  onDelete?: () => void
}) {
  return (
    <Box sx={{ p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.3)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '0.78rem', color: '#786c5c', textTransform: 'uppercase' }}>
          Option {index + 1}
        </Typography>
        {onDelete && (
          <IconButton size="small" onClick={onDelete}
            sx={{ color: '#786c5c', '&:hover': { color: '#b84848' } }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}>
          <TextField label="Label" value={branch.label} onChange={(e) => onChange('label', e.target.value)} fullWidth size="small" required />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl size="small" fullWidth>
            <InputLabel>Outcome Type</InputLabel>
            <Select value={branch.outcomeType} onChange={(e) => onChange('outcomeType', e.target.value)} label="Outcome Type">
              {OUTCOME_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField label="Description" value={branch.description ?? ''} onChange={(e) => onChange('description', e.target.value)} fullWidth size="small" />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Consequence" value={branch.consequence ?? ''} onChange={(e) => onChange('consequence', e.target.value)} fullWidth size="small" />
        </Grid>
      </Grid>
    </Box>
  )
}

export default function DecisionFormDialog({ open, onClose, onSaved, decision }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!decision?.id

  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [missionName, setMissionName] = useState('')
  const [chapterId, setChapterId] = useState('')

  const { data: chaptersData } = useQuery(CHAPTERS, {
    variables: { campaignId },
    skip: !open || !campaignId,
  })
  const chapters: Array<{ id: string; name: string; orderIndex: number }> =
    (chaptersData?.campaign?.chapters ?? []).slice().sort((a: { orderIndex: number }, b: { orderIndex: number }) => a.orderIndex - b.orderIndex)

  // Branches
  const [newBranches, setNewBranches] = useState<NewBranch[]>([defaultNewBranch(), defaultNewBranch()])
  const [existingBranches, setExistingBranches] = useState<ExistingBranch[]>([])
  const [toDelete, setToDelete] = useState<string[]>([])
  const [addedBranches, setAddedBranches] = useState<NewBranch[]>([])

  useEffect(() => {
    if (open) {
      setQuestion(decision?.question ?? '')
      setContext(decision?.context ?? '')
      setMissionName(decision?.missionName ?? '')
      setChapterId(decision?.chapter?.id ?? '')
      setToDelete([])
      setAddedBranches([])
      if (isEdit && decision?.branches) {
        setExistingBranches(decision.branches.map((b) => ({ ...b })))
      } else {
        setNewBranches([defaultNewBranch(), defaultNewBranch()])
        setExistingBranches([])
      }
    }
  }, [open, decision, isEdit])

  const [createDecision, { loading: creating }] = useMutation(CREATE_DECISION, {
    refetchQueries: ['Decisions', 'AllDecisionsTree'],
  })
  const [updateDecision, { loading: updatingDecision }] = useMutation(UPDATE_DECISION, {
    refetchQueries: ['Decisions', 'AllDecisionsTree'],
  })
  const [updateBranch] = useMutation(UPDATE_BRANCH)
  const [addBranch] = useMutation(ADD_BRANCH)
  const [deleteBranch] = useMutation(DELETE_BRANCH)

  const loading = creating || updatingDecision

  const updateExistingBranch = (i: number, field: keyof ExistingBranch, val: string | number) => {
    setExistingBranches((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  const updateNewBranch = (i: number, field: keyof NewBranch, val: string) => {
    setNewBranches((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  const updateAddedBranch = (i: number, field: keyof NewBranch, val: string) => {
    setAddedBranches((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  const handleSave = async () => {
    if (isEdit) {
      await updateDecision({
        variables: {
          id: decision!.id,
          input: {
            question,
            context: context || undefined,
            missionName: missionName || undefined,
            chapterId: chapterId || null,
          },
        },
      })

      for (const b of existingBranches) {
        if (toDelete.includes(b.id)) continue
        await updateBranch({
          variables: {
            id: b.id,
            input: {
              label: b.label,
              description: b.description || undefined,
              consequence: b.consequence || undefined,
              outcomeType: b.outcomeType,
              orderIndex: b.orderIndex,
            },
          },
        })
      }

      for (const bid of toDelete) {
        await deleteBranch({ variables: { id: bid } })
      }

      const lastOrder = existingBranches.filter((b) => !toDelete.includes(b.id)).length
      for (const [i, b] of addedBranches.filter((b) => b.label.trim()).entries()) {
        await addBranch({
          variables: {
            decisionId: decision!.id,
            input: {
              label: b.label,
              description: b.description || undefined,
              consequence: b.consequence || undefined,
              outcomeType: b.outcomeType,
              orderIndex: lastOrder + i,
            },
          },
        })
      }
    } else {
      await createDecision({
        variables: {
          input: {
            campaignId,
            question,
            context: context || undefined,
            missionName: missionName || undefined,
            chapterId: chapterId || undefined,
            branches: newBranches.filter((b) => b.label.trim()).map((b, i) => ({
              label: b.label,
              description: b.description || undefined,
              consequence: b.consequence || undefined,
              outcomeType: b.outcomeType,
              orderIndex: i,
            })),
          },
        },
      })
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Decision' : 'New Decision'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0 }}>

          {/* Core fields */}
          <Grid item xs={12}>
            <TextField label="Question" value={question} onChange={(e) => setQuestion(e.target.value)}
              fullWidth size="small" required multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Mission Name" value={missionName} onChange={(e) => setMissionName(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel>Chapter</InputLabel>
              <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} label="Chapter">
                <MenuItem value=""><em>None</em></MenuItem>
                {chapters.map((ch) => (
                  <MenuItem key={ch.id} value={ch.id}>{ch.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Context / DM Notes" value={context} onChange={(e) => setContext(e.target.value)}
              fullWidth size="small" multiline rows={2} />
          </Grid>

          {/* Branches section */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Divider sx={{ flex: 1, mr: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#786c5c', px: 1 }}>OPTIONS / BRANCHES</Typography>
              </Divider>
              <Button size="small" startIcon={<AddIcon />}
                onClick={() => isEdit
                  ? setAddedBranches((p) => [...p, defaultNewBranch()])
                  : setNewBranches((p) => [...p, defaultNewBranch()])
                }
                sx={{ color: '#c8a44a', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                Add Option
              </Button>
            </Box>
          </Grid>

          {/* Edit mode: existing branches */}
          {isEdit && existingBranches.filter((b) => !toDelete.includes(b.id)).map((b, i) => (
            <Grid item xs={12} key={b.id}>
              <BranchEditor
                branch={b}
                index={i}
                onChange={(field, val) => updateExistingBranch(
                  existingBranches.findIndex((x) => x.id === b.id),
                  field as keyof ExistingBranch,
                  val
                )}
                onDelete={existingBranches.filter((x) => !toDelete.includes(x.id)).length > 1
                  ? () => setToDelete((p) => [...p, b.id])
                  : undefined
                }
              />
            </Grid>
          ))}

          {/* Edit mode: newly added branches */}
          {isEdit && addedBranches.map((b, i) => (
            <Grid item xs={12} key={`new-${i}`}>
              <BranchEditor
                branch={b}
                index={existingBranches.filter((x) => !toDelete.includes(x.id)).length + i}
                onChange={(field, val) => updateAddedBranch(i, field as keyof NewBranch, val)}
                onDelete={() => setAddedBranches((p) => p.filter((_, idx) => idx !== i))}
              />
            </Grid>
          ))}

          {/* Create mode */}
          {!isEdit && newBranches.map((b, i) => (
            <Grid item xs={12} key={i}>
              <BranchEditor
                branch={b}
                index={i}
                onChange={(field, val) => updateNewBranch(i, field as keyof NewBranch, val)}
                onDelete={newBranches.length > 2
                  ? () => setNewBranches((p) => p.filter((_, idx) => idx !== i))
                  : undefined
                }
              />
            </Grid>
          ))}

        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !question} variant="contained" size="small">
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
