import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { motion } from 'framer-motion'
import { staggerContainer } from '../utils/motion'
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Grid, Button, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ViewListIcon from '@mui/icons-material/ViewList'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { useCampaign } from '../context/campaign'
import DecisionCard from '../components/DecisionCard'
import DecisionFormDialog from '../components/DecisionFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import DecisionTreeView from '../components/DecisionTreeView'

const DECISIONS = gql`
  query Decisions($campaignId: ID!, $status: DecisionStatus) {
    decisions(campaignId: $campaignId, status: $status) {
      id question context status orderIndex missionName resolvedAt
      chapter { id name }
      branches { id label description consequence outcomeType orderIndex outcomes }
      chosenBranch { id label }
      incomingLinks { id fromDecision { id } fromBranch { id label } }
    }
  }
`

const RESOLVE = gql`
  mutation ResolveDecision($id: ID!, $branchId: ID!) {
    resolveDecision(id: $id, branchId: $branchId) {
      id status chosenBranch { id label }
    }
  }
`

const DELETE_DECISION = gql`
  mutation DeleteDecision($id: ID!) {
    deleteDecision(id: $id)
  }
`

const STATUSES = ['', 'PENDING', 'ACTIVE', 'RESOLVED', 'SKIPPED']

type DecisionType = {
  id: string; question: string; context?: string | null; status: string
  missionName?: string | null; resolvedAt?: string | null
  branches?: { id: string; label: string; description?: string | null; consequence?: string | null; outcomeType: string; orderIndex: number }[]
}

export default function Decisions() {
  const { campaignId } = useCampaign()
  const [status, setStatus] = useState('')
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editDecision, setEditDecision] = useState<DecisionType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteQuestion, setDeleteQuestion] = useState('')

  const { data, loading, error, refetch } = useQuery(DECISIONS, {
    variables: { campaignId, status: status || undefined },
    skip: !campaignId,
  })

  const [resolve] = useMutation(RESOLVE)
  const [deleteDecision, { loading: deleting }] = useMutation(DELETE_DECISION)

  const handleResolve = async (decisionId: string, branchId: string) => {
    await resolve({ variables: { id: decisionId, branchId } })
    refetch()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteDecision({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4">Decisions</Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* View toggle */}
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => v && setView(v)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: '#786c5c', borderColor: 'rgba(120,108,92,0.3)', px: 1.5,
                '&.Mui-selected': { color: '#c8a44a', bgcolor: 'rgba(200,164,74,0.1)', borderColor: 'rgba(200,164,74,0.4)' },
              },
            }}
          >
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />
              List
            </ToggleButton>
            <ToggleButton value="tree">
              <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Story Tree
            </ToggleButton>
          </ToggleButtonGroup>

          {view === 'list' && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditDecision(null); setFormOpen(true) }}>
            New Decision
          </Button>
        </Box>
      </Box>

      {/* Tree view */}
      {view === 'tree' && <DecisionTreeView />}

      {/* List view */}
      {view === 'list' && (
        <>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>}
          {error && <Alert severity="error">{error.message}</Alert>}

          <Grid container spacing={1.5} component={motion.div} variants={staggerContainer} initial="hidden" animate="visible">
            {data?.decisions?.map((d: Parameters<typeof DecisionCard>[0]['decision'] & DecisionType) => (
              <Grid item xs={12} md={6} key={d.id}>
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton size="small"
                        onClick={(e) => { e.stopPropagation(); setEditDecision(d); setFormOpen(true) }}
                        sx={{ bgcolor: '#0b0906', color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 26, height: 26 }}>
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(d.id); setDeleteQuestion(d.question) }}
                        sx={{ bgcolor: '#0b0906', color: '#786c5c', '&:hover': { color: '#b84848' }, width: 26, height: 26 }}>
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <DecisionCard decision={d} onResolve={handleResolve} />
                </Box>
              </Grid>
            ))}
            {data?.decisions?.length === 0 && (
              <Grid item xs={12}>
                <Typography sx={{ color: '#786c5c', textAlign: 'center', py: 4 }}>No decisions found.</Typography>
              </Grid>
            )}
          </Grid>
        </>
      )}

      <DecisionFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDecision(null) }}
        onSaved={() => refetch()}
        decision={editDecision}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete decision?"
        message={`"${deleteQuestion.slice(0, 60)}${deleteQuestion.length > 60 ? '…' : ''}" will be permanently deleted.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
