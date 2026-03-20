import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Card, CardContent, CircularProgress, Alert,
  Button, IconButton, Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCampaign } from '../context/campaign'
import ReputationBar from '../components/ReputationBar'
import FactionFormDialog from '../components/FactionFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const FACTIONS = gql`
  query Factions($campaignId: ID!) {
    factions(campaignId: $campaignId) {
      id name description reputation repMin repMax color icon
    }
  }
`

const UPDATE_REP = gql`
  mutation UpdateRep($id: ID!, $delta: Int!) {
    updateFactionReputation(id: $id, delta: $delta) { id reputation }
  }
`

const DELETE_FACTION = gql`
  mutation DeleteFaction($id: ID!) {
    deleteFaction(id: $id)
  }
`

type FactionType = {
  id: string; name: string; description?: string | null
  reputation: number; repMin: number; repMax: number; color?: string | null; icon?: string | null
}

export default function Factions() {
  const { campaignId } = useCampaign()
  const [formOpen, setFormOpen] = useState(false)
  const [editFaction, setEditFaction] = useState<FactionType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const { data, loading, error, refetch } = useQuery(FACTIONS, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const [updateRep] = useMutation(UPDATE_REP)
  const [deleteFaction, { loading: deleting }] = useMutation(DELETE_FACTION)

  const handleDelta = async (factionId: string, delta: number) => {
    await updateRep({ variables: { id: factionId, delta } })
    refetch()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteFaction({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Factions</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditFaction(null); setFormOpen(true) }}>
          New Faction
        </Button>
      </Box>

      <Grid container spacing={2}>
        {data?.factions?.map((f: FactionType) => (
          <Grid item xs={12} sm={6} key={f.id}>
            <Card sx={{ border: `1px solid ${f.color ? f.color + '40' : 'rgba(120,108,92,0.3)'}`, position: 'relative' }}>
              <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => { setEditFaction(f); setFormOpen(true) }}
                    sx={{ bgcolor: '#0b0906', color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 26, height: 26 }}>
                    <EditIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => { setDeleteId(f.id); setDeleteName(f.name) }}
                    sx={{ bgcolor: '#0b0906', color: '#786c5c', '&:hover': { color: '#b84848' }, width: 26, height: 26 }}>
                    <DeleteIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 0.5, fontSize: '1rem', color: f.color ?? '#e6d8c0', pr: 6 }}>
                  {f.icon && <span style={{ marginRight: 6 }}>{f.icon}</span>}
                  {f.name}
                </Typography>
                {f.description && (
                  <Typography variant="body2" sx={{ color: '#786c5c', fontSize: '0.82rem', mb: 1.5, lineHeight: 1.5 }}>
                    {f.description}
                  </Typography>
                )}
                <ReputationBar
                  name=""
                  reputation={f.reputation}
                  repMin={f.repMin}
                  repMax={f.repMax}
                  onDelta={(delta) => handleDelta(f.id, delta)}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <FactionFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditFaction(null) }}
        onSaved={() => refetch()}
        faction={editFaction}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        title={`Delete "${deleteName}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
